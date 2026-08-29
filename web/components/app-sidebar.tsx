"use client"

import * as React from "react"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { NavSecondary } from "@/components/nav-secondary"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { removeSession, useChatSessions } from "@/lib/sessions"
import {
  BookOpenIcon,
  ChatCircleIcon,
  DotsThreeOutlineIcon,
  PlusCircleIcon,
  SparkleIcon,
  TrashIcon,
} from "@phosphor-icons/react"

const navSecondary = [
  {
    title: "Flue docs",
    url: "https://flueframework.com",
    icon: <BookOpenIcon />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const sessions = useChatSessions()
  const params = useParams<{ id?: string }>()
  const router = useRouter()
  const { isMobile } = useSidebar()
  const activeId = params?.id

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <SparkleIcon className="size-5! text-primary" />
              <span className="text-base font-semibold">Flue Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  render={<Link href="/" />}
                >
                  <PlusCircleIcon />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Recent chats</SidebarGroupLabel>
          <SidebarMenu>
            {sessions.length === 0 && (
              <p className="px-2 py-1.5 text-muted-foreground text-xs">
                No chats yet. Send a message to start one.
              </p>
            )}
            {sessions.map((session) => (
              <SidebarMenuItem key={session.id}>
                <SidebarMenuButton
                  isActive={session.id === activeId}
                  render={<Link href={`/chat/${session.id}`} />}
                >
                  <ChatCircleIcon />
                  <span>{session.title}</span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuAction
                        showOnHover
                        className="aria-expanded:bg-muted"
                      />
                    }
                  >
                    <DotsThreeOutlineIcon />
                    <span className="sr-only">More</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-44"
                    side={isMobile ? "bottom" : "right"}
                    align={isMobile ? "end" : "start"}
                  >
                    <DropdownMenuItem
                      render={<Link href={`/chat/${session.id}`} />}
                    >
                      <ChatCircleIcon />
                      <span>Open</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        removeSession(session.id)
                        if (session.id === activeId) router.push("/")
                      }}
                    >
                      <TrashIcon />
                      <span>Remove</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
