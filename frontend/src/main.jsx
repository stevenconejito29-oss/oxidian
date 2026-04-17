import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { RouterProvider } from 'react-router-dom'
import { appRouter } from './core/router/AppRouter'
import './legacy/index.css'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider
      router={appRouter}
      future={{ v7_startTransition: true }}
    />
    <Toaster position="top-right" />
  </React.StrictMode>,
)
