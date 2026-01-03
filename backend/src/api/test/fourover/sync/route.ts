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
    // Get category from query param, default to Business Cards
    const categoryId = req.query.category as string || "08a9625a-4152-40cf-9007-b2bbb349efec"
    
    // Fetch products from 4Over for this category
    const data = await fourOverGet(`/printproducts/categories/${categoryId}/products`)
    
    const products = data.entities || data || []
    
    res.json({
      success: true,
      message: `Found ${products.length} products`,
      category_id: categoryId,
      products: products.slice(0, 10), // First 10 products
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}