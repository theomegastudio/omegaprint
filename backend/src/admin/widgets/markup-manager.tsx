import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useState } from "react"

type Category = {
  id: string
  name: string
}

const MarkupManagerWidget = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [defaultMarkup, setDefaultMarkup] = useState("40")
  const [categoryMarkups, setCategoryMarkups] = useState<Record<string, string>>({})
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({})
  const [showDisabled, setShowDisabled] = useState(false)

  const fetchCategories = async () => {
    try {
      const response = await fetch("/test/fourover/categories")
      const data = await response.json()
      if (data.success) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error)
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await fetch("/test/markup")
      const data = await response.json()
      if (data.success) {
        setConfig(data.config)
        setDefaultMarkup(String(data.config.default_markup * 100))
        
        const markups: Record<string, string> = {}
        const enabled: Record<string, boolean> = {}
        
        for (const [id, value] of Object.entries(data.config.category_markups || {})) {
          markups[id] = String((value as any).markup * 100)
          enabled[id] = (value as any).enabled !== false
        }
        
        setCategoryMarkups(markups)
        setEnabledCategories(enabled)
      }
    } catch (error) {
      console.error("Failed to fetch markup config:", error)
    }
  }

  useEffect(() => {
    Promise.all([fetchCategories(), fetchConfig()]).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const categoryMarkupsPayload: Record<string, any> = {}
      for (const cat of categories) {
        if (categoryMarkups[cat.id] || enabledCategories[cat.id] !== undefined) {
          categoryMarkupsPayload[cat.id] = {
            name: cat.name,
            markup: parseFloat(categoryMarkups[cat.id] || defaultMarkup) / 100,
            enabled: enabledCategories[cat.id] !== false,
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

  const toggleCategory = (categoryId: string) => {
    setEnabledCategories({
      ...enabledCategories,
      [categoryId]: !enabledCategories[categoryId],
    })
  }

  const enableAll = () => {
    const allEnabled: Record<string, boolean> = {}
    categories.forEach(cat => { allEnabled[cat.id] = true })
    setEnabledCategories(allEnabled)
  }

  const disableAll = () => {
    const allDisabled: Record<string, boolean> = {}
    categories.forEach(cat => { allDisabled[cat.id] = false })
    setEnabledCategories(allDisabled)
  }

  if (loading) {
    return (
      <div className="bg-ui-bg-base border-ui-border-base rounded-lg border p-6 mb-4">
        <p className="text-ui-fg-subtle">Loading markup configuration...</p>
      </div>
    )
  }

  const enabledCount = categories.filter(cat => enabledCategories[cat.id] !== false).length
  const displayCategories = showDisabled 
    ? categories 
    : categories.filter(cat => enabledCategories[cat.id] !== false)

  return (
    <div className="bg-ui-bg-base border-ui-border-base rounded-lg border mb-4 shadow-elevation-card-rest">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
        <h2 className="text-ui-fg-base font-semibold text-lg">4Over Markup Manager</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchCategories(); fetchConfig(); }}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-base-hover transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-base-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* Default Markup */}
      <div className="px-6 py-4 border-b border-ui-border-base bg-ui-bg-subtle">
        <label className="block text-sm font-medium text-ui-fg-base mb-2">Default Markup</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={defaultMarkup}
            onChange={(e) => setDefaultMarkup(e.target.value)}
            className="w-20 px-2 py-1.5 text-sm rounded-md border border-ui-border-base bg-ui-bg-field text-ui-fg-base focus:outline-none focus:border-ui-border-interactive"
          />
          <span className="text-ui-fg-subtle text-sm">%</span>
        </div>
        <p className="text-ui-fg-muted text-xs mt-1">Applied when no category markup is set</p>
      </div>

      {/* Category Controls */}
      <div className="px-6 py-3 border-b border-ui-border-base flex items-center justify-between">
        <h3 className="text-ui-fg-base font-medium text-sm">Category Markups</h3>
        <div className="flex items-center gap-4">
          <span className="text-ui-fg-muted text-xs">{enabledCount} of {categories.length} enabled</span>
          <div className="flex gap-2">
            <button
              onClick={enableAll}
              className="px-2 py-1 text-xs font-medium rounded border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-base-hover transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={disableAll}
              className="px-2 py-1 text-xs font-medium rounded border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-base-hover transition-colors"
            >
              Disable All
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-ui-fg-subtle cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-ui-border-base"
            />
            Show disabled
          </label>
        </div>
      </div>

      {/* Categories Table */}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-ui-bg-base border-b border-ui-border-base">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-ui-fg-muted uppercase tracking-wider w-16">On</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-ui-fg-muted uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-ui-fg-muted uppercase tracking-wider w-32">Markup</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-ui-fg-muted uppercase tracking-wider w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ui-border-base">
            {displayCategories.map((cat) => {
              const isEnabled = enabledCategories[cat.id] !== false
              return (
                <tr 
                  key={cat.id} 
                  className={`hover:bg-ui-bg-base-hover transition-colors ${!isEnabled ? 'opacity-50' : ''}`}
                >
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleCategory(cat.id)}
                      className="rounded border-ui-border-base w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-ui-fg-base">{cat.name}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
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
                        disabled={!isEnabled}
                        className="w-16 px-2 py-1 text-sm rounded border border-ui-border-base bg-ui-bg-field text-ui-fg-base focus:outline-none focus:border-ui-border-interactive disabled:opacity-50"
                      />
                      <span className="text-ui-fg-muted text-xs">%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleSync(cat.id, cat.name)}
                      disabled={syncing === cat.id || !isEnabled}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-base-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {syncing === cat.id ? "Syncing..." : "Sync"}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {config?.updated_at && (
        <div className="px-6 py-3 border-t border-ui-border-base">
          <p className="text-ui-fg-muted text-xs">
            Last updated: {new Date(config.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default MarkupManagerWidget