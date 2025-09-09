import {
  Dialog,
  IconButton,
  Image,
} from "@chakra-ui/react"

import { X } from "lucide-react"
import LoadingMessage from "./LoadingMessage";

interface plotDialogProps {
    open: boolean
    setOpen: (open: boolean) => void
    title: string
    loadingPlot: boolean
    image?: string
}


export function PlotDialog({open,
                            setOpen,
                            title,
                            loadingPlot,
                            image,
                            }: plotDialogProps ) {

  return (
    <Dialog.Root lazyMount open={open} onOpenChange={(details) => setOpen(details.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
        <Dialog.Content>
            <Dialog.CloseTrigger asChild>
            <IconButton size="sm"
                variant="ghost"
                position="absolute"
                top="0.5rem"
                right="0.5rem"
                aria-label="Close">
                <X />
            </IconButton>
            </Dialog.CloseTrigger>
            <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
            {loadingPlot ? (<LoadingMessage msg="" icon="pulsar"/>) : (<Image src={image} />)}
            </Dialog.Body>                    
        </Dialog.Content>
        </Dialog.Positioner>
    </Dialog.Root>
  )
}