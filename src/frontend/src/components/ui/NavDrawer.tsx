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

import { Link } from 'react-router-dom';

export function NavDrawer() {
  const navItems = [
    { icon: Home, label: "Home", to: "/" },
    { icon: Settings, label: "Settings", to: "/settings" },
    { icon: HelpCircle, label: "Help", to: "/help" },
  ]

  return (
    <Drawer.Root placement='start' size='xs'>
      <Drawer.Trigger asChild>
        <IconButton
          variant="ghost"
          aria-label="Open menu"
          size='lg'
        >
          <Menu size={20} />
        </IconButton>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <HStack justify="flex-end">
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label="Close menu"
                    >
                    <X size={16} />
                  </IconButton>
                </Drawer.CloseTrigger>
              </HStack>
            </Drawer.Header>
            <Drawer.Body>
              <VStack align="start">
                {navItems.map((item) => (
                  <Link to={item.to} style={{width: '100%'}} key={item.label}>
                    <Button
                      key={item.label}
                      variant="ghost"
                      justifyContent="flex-start"
                      w="full"
                      colorPalette='teal'
                    >
                      <HStack>
                        <item.icon size={18} />
                        <Text textStyle='md'>{item.label}</Text>
                      </HStack>
                    </Button>
                  </Link>
                ))}
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}