import { Box, Flex, Heading, Steps, Button, ButtonGroup, VStack, HStack } from "@chakra-ui/react";
import { NavDrawer } from "./NavDrawer";
import { BackButton, HomeButton } from "./Buttons";

export default function PageContainer({ children, hideBackButton = false, showHome = false }: { children: React.ReactNode , hideBackButton?: boolean, showHome?: boolean}) {

  const steps = [
    {
      title: "Step 1",
      description: "Step 1 description",
    },
    {
      title: "Step 2",
      description: "Step 2 description",
    },
    {
      title: "Step 3",
      description: "Step 3 description",
    },
  ]

  return (
    <Box
      maxW="1200px"   // keeps content the same width
      mx="auto"       // centers horizontally
      px={6}          // consistent side padding
      py={4}          // top/bottom spacing
      width='100%'
    >
      <Flex as="header" justify="space-between" align="center" mb={6}>
        <VStack w='100%' align='flex-start'>
        <NavDrawer />
        <Steps.Root defaultStep={1} count={steps.length} colorPalette='teal'>
          <Steps.List>
            {steps.map((step, index) => (
              <Steps.Item key={index} index={index} title={step.title}>
                <Steps.Indicator />
                <Steps.Title>{step.title}</Steps.Title>
                <Steps.Separator />
              </Steps.Item>
            ))}
          </Steps.List>

          {steps.map((step, index) => (
            <Steps.Content key={index} index={index}>
              {step.description}
            </Steps.Content>
          ))}
          <Steps.CompletedContent>All steps are complete!</Steps.CompletedContent>

          <ButtonGroup size="sm" variant="outline">
            <Steps.PrevTrigger asChild>
              <Button>Prev</Button>
            </Steps.PrevTrigger>
            <Steps.NextTrigger asChild>
              <Button>Next</Button>
            </Steps.NextTrigger>
          </ButtonGroup>
        </Steps.Root>
        </VStack>
      </Flex>
      {children}
    </Box>
  );
}
