import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
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
      const separator = url.includes("?") ? "&" : "?"
      url += `${separator}apikey=${this.options_.publicKey}&signature=${signature}`
    } else {
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

  // Required method implementations
  async getFulfillmentOptions(): Promise<any[]> {
    return [
      { id: "fourover-ground", name: "4Over Ground Shipping" },
      { id: "fourover-express", name: "4Over Express Shipping" },
      { id: "fourover-overnight", name: "4Over Overnight Shipping" },
    ]
  }

  async validateFulfillmentData(
    optionData: any,
    data: any,
    context: any
  ): Promise<any> {
    return { ...data, ...optionData }
  }

  async validateOption(data: any): Promise<boolean> {
    const validOptions = ["fourover-ground", "fourover-express", "fourover-overnight"]
    return validOptions.includes(data.id as string)
  }

  async canCalculate(data: any): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: any,
    data: any,
    context: any
  ): Promise<any> {
    return { calculated_amount: 0 }
  }

  async createFulfillment(
    data: any,
    items: any,
    order: any,
    fulfillment: any
  ): Promise<any> {
    return {
      data: { fourover_order_id: null },
      labels: [],
    }
  }

  async cancelFulfillment(fulfillment: any): Promise<void> {
    return
  }

  async getFulfillmentDocuments(data: any): Promise<any[]> {
    return []
  }

  async createReturnFulfillment(fulfillment: any): Promise<any> {
    return {
      data: {},
      labels: [],
    }
  }

  // 4Over-specific helper methods
  async getProductCategories(): Promise<any[]> {
    return this.fourOverRequest("/printproducts/categories", "GET")
  }

  async getProducts(categoryId?: string): Promise<any[]> {
    const endpoint = categoryId 
      ? `/printproducts/categories/${categoryId}/products`
      : "/printproducts/products"
    return this.fourOverRequest(endpoint, "GET")
  }

  async getProductQuote(productId: string, options: Record<string, any>): Promise<any> {
    return this.fourOverRequest("/services/productquote", "POST", {
      product_id: productId,
      ...options,
    })
  }
}

export default FourOverFulfillmentService