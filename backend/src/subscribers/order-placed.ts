import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
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

async function fourOverPost(endpoint: string, body: any) {
  const signature = generateSignature("POST")
  const url = `${BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `API ${PUBLIC_KEY}:${signature}`,
    },
    body: JSON.stringify(body),
  })
  
  return response.json()
}

export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const orderId = event.data.id

  logger.info(`Order placed: ${orderId}`)

  // For now, just log it. Full implementation would:
  // 1. Fetch the order details
  // 2. Check if items have 4Over metadata
  // 3. Submit order to 4Over API
  // 4. Store 4Over order ID in order metadata

  logger.info(`TODO: Submit order ${orderId} to 4Over`)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}