import {
  Button,
  Drawer,
  Portal,
  IconButton,
  VStack,
  HStack,
  Text
} from "@chakra-ui/react"
import { 
  Menu,
  X, 
  Home, 
  User, 
  Settings, 
  BarChart3, 
  Mail, 
  HelpCircle 
} from "lucide-react"

export function NavDrawer() {
  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: HelpCircle, label: "Help", href: "/help" },
  ]

  return (
    <Drawer.Root placement='start'>
      <Drawer.Trigger asChild>
        <IconButton
          variant="outline"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </IconButton>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.CloseTrigger asChild>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Close menu"
                >
                <X size={16} />
              </IconButton>
            </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              <VStack align="start" spacing={2}>
                {navItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    justifyContent="flex-start"
                    w="full"
                    colorPalette='teal'
                  >
                    <HStack>
                      <item.icon size={18} />
                      <Text>{item.label}</Text>
                    </HStack>
                  </Button>
                ))}
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}