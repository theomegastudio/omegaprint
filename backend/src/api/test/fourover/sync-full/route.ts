import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import crypto from "crypto"

const PUBLIC_KEY = process.env.FOUROVER_PUBLIC_KEY || ""
const PRIVATE_KEY = process.env.FOUROVER_PRIVATE_KEY || ""
const BASE_URL = "https://api.4over.com"

function generateSignature(httpMethod: string): string {
  const hashedPrivateKey = crypto
    .createHash("sha256")
    .update(PRIVATE_KEY)
    .digest("hex")

  return crypto
    .createHmac("sha256", hashedPrivateKey)
    .update(httpMethod)
    .digest("hex")
}

async function fourOverGet(endpoint: string) {
  const signature = generateSignature("GET")
  const separator = endpoint.includes("?") ? "&" : "?"
  const url = `${BASE_URL}${endpoint}${separator}apikey=${PUBLIC_KEY}&signature=${signature}`
  
  const response = await fetch(url)
  return response.json()
}

async function getMarkupConfig(storeModule: any) {
  const [store] = await storeModule.listStores()
  return store?.metadata?.markup_config || {
    default_markup: 0.40,
    category_markups: {},
    product_markups: {},
  }
}

function getMarkupForProduct(
  config: any, 
  categoryId: string, 
  productCode: string
): number {
  // Check product-specific markup first
  if (config.product_markups[productCode]) {
    return config.product_markups[productCode].markup
  }
  
  // Then category markup
  if (config.category_markups[categoryId]) {
    return config.category_markups[categoryId].markup
  }
  
  // Fall back to default
  return config.default_markup
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productService = req.scope.resolve(Modules.PRODUCT)
    const storeModule = req.scope.resolve(Modules.STORE)
    
    const { 
      category_id = "08a9625a-4152-40cf-9007-b2bbb349efec",
      update_existing = true,
      limit = 0 // 0 = no limit
    } = req.body as any

    // Get markup configuration
    const markupConfig = await getMarkupConfig(storeModule)

    // Fetch products from 4Over
    const data = await fourOverGet(`/printproducts/categories/${category_id}/products`)
    const fourOverProducts = data.entities || []
    
    const productsToProcess = limit > 0 
      ? fourOverProducts.slice(0, limit) 
      : fourOverProducts

    const results = {
      created: [] as any[],
      updated: [] as any[],
      errors: [] as any[],
    }

    for (const fourOverProduct of productsToProcess) {
      try {
        const handle = fourOverProduct.product_code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        
        // Get the markup for this specific product
        const markup = getMarkupForProduct(
          markupConfig, 
          category_id, 
          fourOverProduct.product_code
        )

        // Check if product already exists
        let existingProduct = null
        try {
          const existing = await productService.listProducts({ handle })
          existingProduct = existing[0] || null
        } catch (e) {
          // Product doesn't exist
        }

        // Fetch base prices
        const pricesData = await fourOverGet(`/printproducts/products/${fourOverProduct.product_uuid}/baseprices`)
        const prices = pricesData.entities || []

        // Build variants with markup applied
        const variants = prices.slice(0, 10).map((price: any) => {
          const costPrice = parseFloat(price.product_baseprice)
          const retailPrice = costPrice * (1 + markup)
          
          return {
            title: `${price.runsize} qty - ${price.colorspec}`,
            sku: `${fourOverProduct.product_code}-${price.runsize}-${price.colorspec}`.replace(/[^a-zA-Z0-9-]/g, ''),
            prices: [
              {
                amount: Math.round(retailPrice * 100),
                currency_code: "usd",
              }
            ],
            metadata: {
              fourover_price_uuid: price.base_price_uuid,
              fourover_runsize: price.runsize,
              fourover_colorspec: price.colorspec,
              fourover_cost: costPrice,
              markup_applied: markup,
              retail_price: retailPrice,
            },
            manage_inventory: false,
          }
        })

        if (existingProduct && update_existing) {
          await productService.updateProducts(existingProduct.id, {
            metadata: {
              fourover_product_uuid: fourOverProduct.product_uuid,
              fourover_product_code: fourOverProduct.product_code,
              fourover_category_id: category_id,
              last_synced: new Date().toISOString(),
              markup_applied: markup,
            },
          })
          
          results.updated.push({
            id: existingProduct.id,
            title: existingProduct.title,
            markup: `${(markup * 100).toFixed(0)}%`,
          })
        } else if (!existingProduct) {
          const product = await productService.createProducts({
            title: fourOverProduct.product_description,
            handle,
            status: "draft",
            metadata: {
              fourover_product_uuid: fourOverProduct.product_uuid,
              fourover_product_code: fourOverProduct.product_code,
              fourover_category_id: category_id,
              last_synced: new Date().toISOString(),
              markup_applied: markup,
            },
            variants,
          })

          results.created.push({
            id: product.id,
            title: product.title,
            variants_count: variants.length,
            markup: `${(markup * 100).toFixed(0)}%`,
          })
        }

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error: any) {
        results.errors.push({
          product_code: fourOverProduct.product_code,
          error: error.message,
        })
      }
    }

    // Get category name for response
    const categoryName = markupConfig.category_markups[category_id]?.name || "Unknown"

    res.json({
      success: true,
      category: {
        id: category_id,
        name: categoryName,
        markup: markupConfig.category_markups[category_id]?.markup || markupConfig.default_markup,
      },
      summary: {
        total_from_4over: fourOverProducts.length,
        processed: productsToProcess.length,
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length,
      },
      results,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}