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
    // Get products directly (not through categories)
    const data = await fourOverGet("/printproducts/products")
    
    // Extract unique product types/names
    const products = data.entities || []
    
    // Group by first word or common pattern
    const grouped: Record<string, number> = {}
    for (const p of products) {
      // Try to extract category from product description
      const desc = p.product_description || ""
      const firstPart = desc.split(" ")[0]
      grouped[firstPart] = (grouped[firstPart] || 0) + 1
    }
    
    res.json({
      success: true,
      total_products: data.totalResults,
      products_on_page: products.length,
      currentPage: data.currentPage,
      maxPages: data.maximumPages,
      sample_products: products.slice(0, 10).map((p: any) => ({
        code: p.product_code,
        description: p.product_description,
      })),
      grouped_by_first_word: grouped,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}