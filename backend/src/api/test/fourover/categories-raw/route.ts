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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const signature = generateSignature("GET")
    
    // Try different parameters to get more results
    const tests = [
      { name: "default", url: `/printproducts/categories` },
      { name: "limit=100", url: `/printproducts/categories?limit=100` },
      { name: "per_page=100", url: `/printproducts/categories?per_page=100` },
      { name: "pageSize=100", url: `/printproducts/categories?pageSize=100` },
      { name: "count=100", url: `/printproducts/categories?count=100` },
      { name: "maxResults=100", url: `/printproducts/categories?maxResults=100` },
      { name: "size=100", url: `/printproducts/categories?size=100` },
      { name: "rows=100", url: `/printproducts/categories?rows=100` },
    ]
    
    const results = []
    
    for (const test of tests) {
      try {
        const url = `${BASE_URL}${test.url}${test.url.includes('?') ? '&' : '?'}apikey=${PUBLIC_KEY}&signature=${signature}`
        const response = await fetch(url)
        const data = await response.json()
        
        results.push({
          test: test.name,
          returned: data.entities?.length || 0,
          totalResults: data.totalResults,
        })
      } catch (e: any) {
        results.push({ test: test.name, error: e.message })
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    res.json({ success: true, results })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}