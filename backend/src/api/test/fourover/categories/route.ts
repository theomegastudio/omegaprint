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
    const allCategories: any[] = []
    let currentPage = 0
    let maxPages = 1

    // Fetch all pages
    while (currentPage <= maxPages) {
      const data = await fourOverGet(`/printproducts/categories?page=${currentPage}`)
      
      if (data.entities) {
        allCategories.push(...data.entities)
      }
      
      maxPages = data.maximumPages || 0
      currentPage++
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Deduplicate by name - keep the first occurrence of each name
    const seenNames = new Set<string>()
    const uniqueCategories = allCategories.filter((cat) => {
      if (seenNames.has(cat.category_name)) {
        return false
      }
      seenNames.add(cat.category_name)
      return true
    })

    const categories = uniqueCategories.map((cat: any) => ({
      id: cat.category_uuid,
      name: cat.category_name,
      description: cat.category_description,
    }))

    // Sort alphabetically
    categories.sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      success: true,
      total: categories.length,
      total_from_api: allCategories.length,
      categories,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}