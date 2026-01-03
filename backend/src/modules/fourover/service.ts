import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import {
  CreateFulfillmentResult,
  FulfillmentOption,
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentItemResult,
} from "@medusajs/types"
import crypto from "crypto"

type FourOverOptions = {
  publicKey: string
  privateKey: string
  baseUrl?: string
}

type InjectedDependencies = {
  logger: any
}

class FourOverFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "fourover"
  
  protected options_: FourOverOptions
  protected logger_: any
  protected baseUrl_: string

  constructor(container: InjectedDependencies, options: FourOverOptions) {
    super()
    this.options_ = options
    this.logger_ = container.logger
    this.baseUrl_ = options.baseUrl || "https://api.4over.com"
  }

  /**
   * Generate HMAC-SHA256 signature for 4Over API
   */
  private generateSignature(httpMethod: string): string {
    const hashedPrivateKey = crypto
      .createHash("sha256")
      .update(this.options_.privateKey)
      .digest("hex")

    const signature = crypto
      .createHmac("sha256", hashedPrivateKey)
      .update(httpMethod)
      .digest("hex")

    return signature
  }

  /**
   * Make authenticated request to 4Over API
   */
  private async fourOverRequest(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any
  ): Promise<any> {
    const signature = this.generateSignature(method)
    
    let url = `${this.baseUrl_}${endpoint}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (method === "GET" || method === "DELETE") {
      // For GET/DELETE, add auth to query string
      const separator = url.includes("?") ? "&" : "?"
      url += `${separator}apikey=${this.options_.publicKey}&signature=${signature}`
    } else {
      // For POST/PUT/PATCH, add auth to header
      headers["Authorization"] = `API ${this.options_.publicKey}:${signature}`
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const errorText = await response.text()
        this.logger_.error(`4Over API error: ${response.status} - ${errorText}`)
        throw new Error(`4Over API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      this.logger_.error(`4Over request failed: ${error}`)
      throw error
    }
  }

  /**
   * Get available fulfillment options (shipping methods)
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    // 4Over shipping options - these are their standard methods
    return [
      {
        id: "fourover-ground",
        name: "4Over Ground Shipping",
      },
      {
        id: "fourover-express",
        name: "4Over Express Shipping",
      },
      {
        id: "fourover-overnight",
        name: "4Over Overnight Shipping",
      },
    ]
  }

  /**
   * Validate fulfillment data before creating
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Validate shipping address exists
    if (!data.shipping_address) {
      throw new Error("Shipping address is required for 4Over fulfillment")
    }
    
    return {
      ...data,
      ...optionData,
    }
  }

  /**
   * Validate shipping option
   */
  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    // Check if it's one of our valid options
    const validOptions = ["fourover-ground", "fourover-express", "fourover-overnight"]
    return validOptions.includes(data.id as string)
  }

  /**
   * Check if this provider can calculate shipping for given context
   */
  async canCalculate(data: Record<string, unknown>): Promise<boolean> {
    // We can calculate if we have a valid shipping address
    return !!data.shipping_address
  }

  /**
   * Calculate shipping price using 4Over API
   */
  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      // Get shipping quote from 4Over
      const shippingAddress = context.shipping_address

      if (!shippingAddress) {
        return { calculated_amount: 0 }
      }

      // Map our option IDs to 4Over shipping methods
      const shippingMethodMap: Record<string, string> = {
        "fourover-ground": "ground",
        "fourover-express": "express", 
        "fourover-overnight": "overnight",
      }

      const fourOverMethod = shippingMethodMap[optionData.id as string] || "ground"

      // Call 4Over shipping quote API
      const quoteRequest = {
        shipping_method: fourOverMethod,
        destination: {
          address1: shippingAddress.address_1,
          address2: shippingAddress.address_2 || "",
          city: shippingAddress.city,
          state: shippingAddress.province,
          zip: shippingAddress.postal_code,
          country: shippingAddress.country_code,
        },
        // Weight would come from cart items - default for now
        weight: context.total_weight || 1,
      }

      const quote = await this.fourOverRequest(
        "/services/shipping/quote",
        "POST",
        quoteRequest
      )

      // Return price in cents
      const priceInCents = Math.round((quote.rate || 0) * 100)
      
      return {
        calculated_amount: priceInCents,
      }
    } catch (error) {
      this.logger_.error(`Failed to calculate 4Over shipping: ${error}`)
      // Return 0 if calculation fails - you might want to handle this differently
      return { calculated_amount: 0 }
    }
  }

  /**
   * Create a fulfillment (submit order to 4Over)
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Record<string, unknown>[],
    order: Record<string, unknown>,
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    try {
      const shippingAddress = order.shipping_address as any

      // Build 4Over order payload
      const fourOverOrder = {
        shipping_address: {
          company: shippingAddress?.company || "",
          first_name: shippingAddress?.first_name,
          last_name: shippingAddress?.last_name,
          address1: shippingAddress?.address_1,
          address2: shippingAddress?.address_2 || "",
          city: shippingAddress?.city,
          state: shippingAddress?.province,
          zip: shippingAddress?.postal_code,
          country: shippingAddress?.country_code,
          phone: shippingAddress?.phone || "",
        },
        items: items.map((item: any) => ({
          product_id: item.variant?.metadata?.fourover_product_id,
          quantity: item.quantity,
          // Add any print-specific options from metadata
          options: item.variant?.metadata?.fourover_options || {},
        })),
        // Reference back to Medusa order
        reference_id: order.id,
        shipping_method: data.shipping_method || "ground",
      }

      // Submit order to 4Over
      const response = await this.fourOverRequest(
        "/orders",
        "POST",
        fourOverOrder
      )

      this.logger_.info(`4Over order created: ${response.order_id}`)

      return {
        data: {
          fourover_order_id: response.order_id,
          fourover_status: response.status,
        },
        items: items.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
        })) as CreateFulfillmentItemResult[],
      }
    } catch (error) {
      this.logger_.error(`Failed to create 4Over fulfillment: ${error}`)
      throw error
    }
  }

  /**
   * Cancel a fulfillment
   */
  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<void> {
    const fourOverOrderId = (fulfillment.data as any)?.fourover_order_id

    if (fourOverOrderId) {
      try {
        await this.fourOverRequest(
          `/orders/${fourOverOrderId}/cancel`,
          "POST"
        )
        this.logger_.info(`4Over order ${fourOverOrderId} cancelled`)
      } catch (error) {
        this.logger_.error(`Failed to cancel 4Over order: ${error}`)
        throw error
      }
    }
  }

  /**
   * Get tracking information
   */
  async getFulfillmentDocuments(
    data: Record<string, unknown>
  ): Promise<never[]> {
    // 4Over may provide shipping labels/documents
    return []
  }

  /**
   * Create return fulfillment
   */
  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Handle returns if 4Over supports it
    return {}
  }

  /**
   * Get shipment status from 4Over
   */
  async getShipmentStatus(
    fourOverOrderId: string
  ): Promise<{ status: string; tracking_number?: string }> {
    try {
      const response = await this.fourOverRequest(
        `/orders/${fourOverOrderId}/tracking`,
        "GET"
      )

      return {
        status: response.status,
        tracking_number: response.tracking_number,
      }
    } catch (error) {
      this.logger_.error(`Failed to get 4Over shipment status: ${error}`)
      throw error
    }
  }

  // ============================================
  // 4Over-specific helper methods
  // ============================================

  /**
   * Get product categories from 4Over
   */
  async getProductCategories(): Promise<any[]> {
    return this.fourOverRequest("/printproducts/categories", "GET")
  }

  /**
   * Get products from 4Over
   */
  async getProducts(categoryId?: string): Promise<any[]> {
    const endpoint = categoryId 
      ? `/printproducts/products?category_id=${categoryId}`
      : "/printproducts/products"
    return this.fourOverRequest(endpoint, "GET")
  }

  /**
   * Get product pricing from 4Over
   */
  async getProductQuote(
    productId: string,
    options: Record<string, any>
  ): Promise<any> {
    return this.fourOverRequest("/services/productquote", "POST", {
      product_id: productId,
      ...options,
    })
  }

  /**
   * Validate an address with 4Over
   */
  async validateAddress(address: {
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    country: string
  }): Promise<any> {
    return this.fourOverRequest("/services/shipping/validate", "POST", address)
  }
}

export default FourOverFulfillmentService
