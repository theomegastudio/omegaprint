import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// GET - Retrieve all markup rules
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const storeModule = req.scope.resolve(Modules.STORE)
    const [store] = await storeModule.listStores()
    
    const markupConfig = store?.metadata?.markup_config || {
      default_markup: 0.40,
      category_markups: {},
      product_markups: {},
    }

    res.json({
      success: true,
      config: markupConfig,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

// POST - Update markup rules
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const storeModule = req.scope.resolve(Modules.STORE)
    const [store] = await storeModule.listStores()
    
    if (!store) {
      throw new Error("No store found")
    }

    const { default_markup, category_markups, product_markups } = req.body as any

    // Get existing config
    const existingConfig = store.metadata?.markup_config || {
      default_markup: 0.40,
      category_markups: {},
      product_markups: {},
    }

    // Merge updates
    const newConfig = {
      default_markup: default_markup ?? existingConfig.default_markup,
      category_markups: {
        ...existingConfig.category_markups,
        ...category_markups,
      },
      product_markups: {
        ...existingConfig.product_markups,
        ...product_markups,
      },
      updated_at: new Date().toISOString(),
    }

    // Save to store metadata
    await storeModule.updateStores(store.id, {
      metadata: {
        ...store.metadata,
        markup_config: newConfig,
      },
    })

    res.json({
      success: true,
      message: "Markup config updated",
      config: newConfig,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}