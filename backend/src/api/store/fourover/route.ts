import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const fulfillmentService = req.scope.resolve("fourover")
    
    // Test: Get product categories from 4Over
    const categories = await fulfillmentService.getProductCategories()
    
    res.json({
      success: true,
      message: "4Over connection working!",
      categories: categories.slice(0, 5),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}
