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

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productService = req.scope.resolve(Modules.PRODUCT)
    
    // Get category from body or default to Business Cards
    const { category_id = "08a9625a-4152-40cf-9007-b2bbb349efec", limit = 5 } = req.body as any

    // Fetch products from 4Over
    const data = await fourOverGet(`/printproducts/categories/${category_id}/products`)
    const fourOverProducts = data.entities || []

    const createdProducts = []

    for (const fourOverProduct of fourOverProducts.slice(0, limit)) {
      // Fetch base prices for this product
      const pricesData = await fourOverGet(`/printproducts/products/${fourOverProduct.product_uuid}/baseprices`)
      const prices = pricesData.entities || []

      // Get the lowest price as the base price
      const lowestPrice = prices.reduce((min: any, p: any) => {
        const price = parseFloat(p.product_baseprice)
        return price < min ? price : min
      }, Infinity)

      // Create variants based on quantity options
      const variants = prices.slice(0, 6).map((price: any) => ({
        title: `${price.runsize} qty - ${price.colorspec}`,
        sku: `${fourOverProduct.product_code}-${price.runsize}-${price.colorspec}`.replace(/[^a-zA-Z0-9-]/g, ''),
        prices: [
          {
            amount: Math.round(parseFloat(price.product_baseprice) * 100), // Convert to cents
            currency_code: "usd",
          }
        ],
        metadata: {
          fourover_price_uuid: price.base_price_uuid,
          fourover_runsize: price.runsize,
          fourover_colorspec: price.colorspec,
        },
        manage_inventory: false,
      }))

      // Create the product in Medusa
      const product = await productService.createProducts({
        title: fourOverProduct.product_description,
        handle: fourOverProduct.product_code.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: "draft", // Start as draft so you can review
        metadata: {
          fourover_product_uuid: fourOverProduct.product_uuid,
          fourover_product_code: fourOverProduct.product_code,
        },
        variants,
      })

      createdProducts.push({
        medusa_id: product.id,
        title: product.title,
        variants_count: variants.length,
      })
    }

    res.json({
      success: true,
      message: `Imported ${createdProducts.length} products`,
      products: createdProducts,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    })
  }
}