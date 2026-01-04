import { defineWidgetConfig } from "@medusajs/admin-sdk"
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
    return <div style={{ padding: "20px" }}>Loading markup configuration...</div>
  }

  return (
    <div style={{ 
      padding: "24px", 
      backgroundColor: "#1a1a2e", 
      borderRadius: "8px", 
      marginBottom: "24px",
      color: "#fff"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>4Over Markup Manager</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 16px",
            backgroundColor: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      <div style={{ 
        backgroundColor: "#252542", 
        padding: "16px", 
        borderRadius: "6px", 
        marginBottom: "20px" 
      }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}>Default Markup</label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="number"
            value={defaultMarkup}
            onChange={(e) => setDefaultMarkup(e.target.value)}
            style={{
              width: "80px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #444",
              backgroundColor: "#1a1a2e",
              color: "#fff",
            }}
          />
          <span>%</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#888" }}>
          Applied when no category or product markup is set
        </p>
      </div>

      <div>
        <h3 style={{ marginBottom: "12px", fontWeight: 500 }}>Category Markups</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={{ textAlign: "left", padding: "12px 8px", color: "#888" }}>Category</th>
              <th style={{ textAlign: "left", padding: "12px 8px", color: "#888" }}>Markup %</th>
              <th style={{ textAlign: "left", padding: "12px 8px", color: "#888" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {FOUROVER_CATEGORIES.map((cat) => (
              <tr key={cat.id} style={{ borderBottom: "1px solid #252542" }}>
                <td style={{ padding: "12px 8px" }}>{cat.name}</td>
                <td style={{ padding: "12px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      value={categoryMarkups[cat.id] || ""}
                      onChange={(e) =>
                        setCategoryMarkups({
                          ...categoryMarkups,
                          [cat.id]: e.target.value,
                        })
                      }
                      placeholder={defaultMarkup}
                      style={{
                        width: "70px",
                        padding: "6px",
                        borderRadius: "4px",
                        border: "1px solid #444",
                        backgroundColor: "#1a1a2e",
                        color: "#fff",
                      }}
                    />
                    <span>%</span>
                  </div>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <button
                    onClick={() => handleSync(cat.id, cat.name)}
                    disabled={syncing === cat.id}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: syncing === cat.id ? "#444" : "#374151",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: syncing === cat.id ? "not-allowed" : "pointer",
                      fontSize: "13px",
                    }}
                  >
                    {syncing === cat.id ? "Syncing..." : "Sync Products"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {config?.updated_at && (
        <p style={{ marginTop: "16px", fontSize: "12px", color: "#666" }}>
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default MarkupManagerWidget