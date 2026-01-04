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
    // Get products from each of our 20 categories
    const categories = [
      { id: "08a9625a-4152-40cf-9007-b2bbb349efec", name: "Business Cards" },
      { id: "4edd37b2-c6d5-4938-b6c7-35e09cd7bf76", name: "Flyers and Brochures" },
      { id: "35170807-4aa5-4d13-986f-c0e266a5d685", name: "Indoor Banner" },
      { id: "393c5a2d-8be0-4134-9161-aa35fdc60685", name: "Large Posters" },
      { id: "5cacc269-e6a8-472d-91d6-792c4584cae8", name: "Door Hangers" },
      { id: "56c6dd85-d838-4ca0-9f9d-e3a63e594f98", name: "Hang Tags" },
      { id: "5502b7a1-cffc-4069-bc2e-7171c86ebdb6", name: "Letterheads" },
      { id: "19a9a6c8-a8c8-4d0c-b4fc-8a231c1bdd53", name: "Magnets" },
      { id: "059ea2cb-f0c5-4853-9724-a8815a2f6b48", name: "Menus" },
      { id: "2e6a67e3-dd44-46c4-a183-e873b9f691a6", name: "Calendars" },
      { id: "04072d2d-8cc5-472f-bc1f-9243382992dc", name: "Flags" },
      { id: "4bf65303-b799-4f45-b3d9-6cc105eb78a4", name: "Adhesive Vinyl" },
      { id: "2d084783-38ef-4a1c-a5fb-7ec8e78700cd", name: "Window Clings" },
      { id: "5b0ab4cc-8ab1-4377-b42d-d3db500a9e44", name: "Car Magnets" },
      { id: "395c3c6f-a90b-4c0d-beb5-887313108d05", name: "Event Tickets" },
      { id: "50a1f1a2-3567-4618-a703-074471472e8d", name: "Every Door Direct Mail" },
      { id: "4cb9f549-5376-4d43-8530-b04632d026a8", name: "Pearl Cards" },
      { id: "4221cd91-1aec-4d6e-88e9-b573a011edb2", name: "Dual Raised" },
      { id: "4b277927-cdf9-4b3d-9b10-dcd8a7e3e0ce", name: "Proofs" },
      { id: "51d3048a-0b7c-438e-b12d-67d7cf37e8f4", name: "Additional Hardware" },
    ]

    const results = []
    let totalProducts = 0

    for (const cat of categories) {
      const data = await fourOverGet(`/printproducts/categories/${cat.id}/products`)
      const count = data.totalResults || data.entities?.length || 0
      totalProducts += count
      
      results.push({
        name: cat.name,
        product_count: count,
        sample: data.entities?.[0]?.product_description || "N/A",
      })
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Sort by product count
    results.sort((a, b) => b.product_count - a.product_count)

    res.json({
      success: true,
      total_categories: categories.length,
      total_products_across_categories: totalProducts,
      categories: results,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}