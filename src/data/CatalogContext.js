import { createContext, useContext } from 'react'

export const CatalogCtx = createContext(null)
export const useCatalog = () => useContext(CatalogCtx)
