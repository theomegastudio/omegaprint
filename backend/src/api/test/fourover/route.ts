import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"

const PUBLIC_KEY = process.env.FOUROVER_PUBLIC_KEY || ""
const PRIVATE_KEY = process.env.FOUROVER_PRIVATE_KEY || ""

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const signature = generateSignature("GET")
    const url = `https://api.4over.com/printproducts/categories?apikey=${PUBLIC_KEY}&signature=${signature}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    res.json({
      success: true,
      message: "4Over API connection working!",
      total_categories: Array.isArray(data) ? data.length : 0,
      sample: Array.isArray(data) ? data.slice(0, 5) : data,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}