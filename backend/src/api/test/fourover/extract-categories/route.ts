import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Start with our known 20 categories
    const knownCategories = [
      "08a9625a-4152-40cf-9007-b2bbb349efec", // Business Cards
      "4edd37b2-c6d5-4938-b6c7-35e09cd7bf76", // Flyers and Brochures
      "35170807-4aa5-4d13-986f-c0e266a5d685", // Indoor Banner
      "393c5a2d-8be0-4134-9161-aa35fdc60685", // Large Posters
      "4bf65303-b799-4f45-b3d9-6cc105eb78a4", // Adhesive Vinyl
    ]

    const categoriesMap: Record<string, { name: string; description: string; productCount?: number }> = {}
    
    // For each known category, get products, then check what other categories those products belong to
    for (const catId of knownCategories) {
      // Get products in this category
      const productsData = await fourOverGet(`/printproducts/categories/${catId}/products`)
      const products = productsData.entities || []
      
      // Sample a few products from each category
      for (const product of products.slice(0, 5)) {
        try {
          const catData = await fourOverGet(`/printproducts/products/${product.product_uuid}/categories`)
          
          for (const cat of (catData.entities || [])) {
            if (!categoriesMap[cat.category_uuid]) {
              categoriesMap[cat.category_uuid] = {
                name: cat.category_name,
                description: cat.category_description,
              }
            }
          }
        } catch (e) {
          // Skip errors
        }
        await new Promise(resolve => setTimeout(resolve, 30))
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // Also add the Acrylic Signs we found
    const additionalCategories = [
      "7ad1aae9-741d-40f5-b3dc-6d75524878ce", // Acrylic Signs
    ]
    
    for (const catId of additionalCategories) {
      if (!categoriesMap[catId]) {
        const productsData = await fourOverGet(`/printproducts/categories/${catId}/products`)
        categoriesMap[catId] = {
          name: "Acrylic Signs",
          description: "Acrylic Signs",
          productCount: productsData.totalResults,
        }
        
        // Sample products from this category too
        const products = productsData.entities || []
        for (const product of products.slice(0, 3)) {
          try {
            const catData = await fourOverGet(`/printproducts/products/${product.product_uuid}/categories`)
            for (const cat of (catData.entities || [])) {
              if (!categoriesMap[cat.category_uuid]) {
                categoriesMap[cat.category_uuid] = {
                  name: cat.category_name,
                  description: cat.category_description,
                }
              }
            }
          } catch (e) {}
          await new Promise(resolve => setTimeout(resolve, 30))
        }
      }
    }

    const categories = Object.entries(categoriesMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      success: true,
      unique_categories_found: categories.length,
      categories,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}