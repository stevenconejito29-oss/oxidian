import React from 'react'
import { Outlet } from 'react-router-dom'
import ThemeBoot from '../providers/ThemeBoot'
import UserMenu from './UserMenu'

export default function AppLayout() {
  return (
    <>
      <ThemeBoot />
      <UserMenu />
      <Outlet />
    </>
  )
}
