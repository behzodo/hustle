"use client"

import { SidebarSimpleIcon } from "@phosphor-icons/react"
import { useUser } from "@clerk/nextjs"

import { SearchForm } from "@/components/search-form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()
  const { user } = useUser()

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <SidebarSimpleIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="flex items-center gap-2">
                {/* The flat mark, not <MetallicLogo /> — that one paints a
                    WebGL canvas, which is a lot of machinery for 20px. */}
                <Avatar className="size-5 rounded-sm">
                  <AvatarImage src="/icon.svg" alt="" />
                  <AvatarFallback>H</AvatarFallback>
                </Avatar>
                Hustle
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="flex items-center gap-2">
                <Avatar className="size-5">
                  <AvatarImage src={user?.imageUrl} alt="" />
                  <AvatarFallback>
                    {user?.firstName?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {user?.firstName ?? "You"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <SearchForm className="w-full sm:ml-auto sm:w-auto" />
      </div>
    </header>
  )
}
