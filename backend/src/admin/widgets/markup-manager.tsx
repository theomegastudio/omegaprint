import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input, Table, Badge } from "@medusajs/ui"
import { useEffect, useState } from "react"

const FOUROVER_CATEGORIES = [
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
]

const MarkupManagerWidget = () => {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [defaultMarkup, setDefaultMarkup] = useState("40")
  const [categoryMarkups, setCategoryMarkups] = useState<Record<string, string>>({})

  const fetchConfig = async () => {
    try {
      const response = await fetch("/test/markup")
      const data = await response.json()
      if (data.success) {
        setConfig(data.config)
        setDefaultMarkup(String(data.config.default_markup * 100))
        
        const markups: Record<string, string> = {}
        for (const [id, value] of Object.entries(data.config.category_markups || {})) {
          markups[id] = String((value as any).markup * 100)
        }
        setCategoryMarkups(markups)
      }
    } catch (error) {
      console.error("Failed to fetch markup config:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const categoryMarkupsPayload: Record<string, any> = {}
      for (const cat of FOUROVER_CATEGORIES) {
        if (categoryMarkups[cat.id]) {
          categoryMarkupsPayload[cat.id] = {
            name: cat.name,
            markup: parseFloat(categoryMarkups[cat.id]) / 100,
          }
        }
      }

      const response = await fetch("/test/markup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_markup: parseFloat(defaultMarkup) / 100,
          category_markups: categoryMarkupsPayload,
        }),
      })
      
      const data = await response.json()
      if (data.success) {
        alert("Markup configuration saved!")
        fetchConfig()
      }
    } catch (error) {
      console.error("Failed to save:", error)
      alert("Failed to save markup configuration")
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async (categoryId: string, categoryName: string) => {
    setSyncing(categoryId)
    try {
      const response = await fetch("/test/fourover/sync-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId }),
      })
      
      const data = await response.json()
      if (data.success) {
        alert(`Synced ${categoryName}: ${data.summary.created} created, ${data.summary.updated} updated`)
      } else {
        alert(`Sync failed: ${data.error}`)
      }
    } catch (error) {
      console.error("Sync failed:", error)
      alert("Sync failed")
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <Container>
        <Text>Loading markup configuration...</Text>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <Heading level="h2">4Over Markup Manager</Heading>
          <Button onClick={handleSave} isLoading={saving}>
            Save Configuration
          </Button>
        </div>

        <div className="bg-ui-bg-subtle p-4 rounded-lg">
          <Text className="font-medium mb-2">Default Markup</Text>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={defaultMarkup}
              onChange={(e) => setDefaultMarkup(e.target.value)}
              className="w-24"
            />
            <Text>%</Text>
          </div>
          <Text className="text-ui-fg-subtle text-sm mt-1">
            Applied when no category or product markup is set
          </Text>
        </div>

        <div>
          <Text className="font-medium mb-2">Category Markups</Text>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell>Markup %</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {FOUROVER_CATEGORIES.map((cat) => (
                <Table.Row key={cat.id}>
                  <Table.Cell>{cat.name}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={categoryMarkups[cat.id] || ""}
                        onChange={(e) =>
                          setCategoryMarkups({
                            ...categoryMarkups,
                            [cat.id]: e.target.value,
                          })
                        }
                        placeholder={defaultMarkup}
                        className="w-20"
                      />
                      <Text>%</Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleSync(cat.id, cat.name)}
                      isLoading={syncing === cat.id}
                    >
                      Sync Products
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {config?.updated_at && (
          <Text className="text-ui-fg-subtle text-sm">
            Last updated: {new Date(config.updated_at).toLocaleString()}
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default MarkupManagerWidget