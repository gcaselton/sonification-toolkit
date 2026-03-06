import React, { useEffect, useState, createContext, ChangeEvent, useRef } from "react";
import { data, useLocation, useNavigate } from 'react-router-dom';
import StyleCard from "../ui/StyleCard";
import {BackButton} from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import { ToggleTip, InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";
import { apiUrl, lightCurvesAPI, coreAPI} from "../../apiConfig";

import {
  Box,
  Button,
  Card,
  Checkbox,
  Collapsible,
  createListCollection,
  Dialog,
  Heading,
  HStack,
  Link,
  LinkBox,
  LinkOverlay,
  SegmentGroup,
  Select,
  Stack,
  Switch,
  Text  
} from "@chakra-ui/react";
import { apiRequest } from "../../utils/requests";


export default function CustomStyleMenu(){

    return (
      <Dialog.Root
        lazyMount
        open={open}
        placement="center"
        onOpenChange={(details) => setOpen(details.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Custom Style</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Box>
                <input
                  type="file"
                  ref={inputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  accept=".yml"
                />
                <Tooltip
                  content="Upload your own config file"
                  positioning={{ placement: "right" }}
                >
                  <Button colorPalette="teal" onClick={handleButtonClick}>
                    Upload Custom YAML File
                  </Button>
                </Tooltip>
                <form>
                  <br />
                  <Select.Root
                    collection={soundOptions}
                    size="sm"
                    width="320px"
                    onValueChange={handleSelectSound}
                  >
                    <Select.HiddenSelect />
                    <HStack>
                      <Select.Label>Base Sound</Select.Label>
                      <InfoTip
                        content="This is the underlying sound (or instrument) that is used as a basis for the sonification."
                        positioning={{ placement: "right" }}
                      />
                    </HStack>
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder={sound.name} />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Content>
                      {soundOptions.items.map((option) => (
                        <Select.Item item={option} key={option.value}>
                          {option.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                  <br />
                  <HStack>
                    <Text fontWeight="medium">Parameters</Text>
                    <InfoTip
                      content="These are the aspects of the sound that will be controlled by the data."
                      positioning={{ placement: "right" }}
                    />
                  </HStack>

                  <br />
                  <Stack gap="4" direction="row" wrap="wrap">
                    <Checkbox.Root
                      key={parameters[0]}
                      checked={filterCutoff}
                      onCheckedChange={handleChangeFilterCutoff}
                      colorPalette="teal"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>{parameters[0]}</Checkbox.Label>
                    </Checkbox.Root>
                    <Checkbox.Root
                      key={parameters[1]}
                      checked={pitch}
                      onCheckedChange={handleChangePitch}
                      colorPalette="teal"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>{parameters[1]}</Checkbox.Label>
                    </Checkbox.Root>
                    <Checkbox.Root
                      key={parameters[2]}
                      checked={volume}
                      onCheckedChange={handleChangeVolume}
                      colorPalette="teal"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>{parameters[2]}</Checkbox.Label>
                    </Checkbox.Root>
                    {/* <Checkbox.Root key={parameters[3]} defaultChecked={leftRightPan} onCheckedChange={handleChangeLeftRightPan} colorPalette='teal'>
                                    <Checkbox.HiddenInput />
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <Checkbox.Label>{parameters[3]}</Checkbox.Label>
                                </Checkbox.Root> */}
                  </Stack>
                  <br />
                  {sound.composable && (
                    <Collapsible.Root transition="opacity 0.3s ease-in-out">
                      <Collapsible.Trigger>
                        <Text
                          color="teal"
                          fontWeight="medium"
                          cursor="pointer"
                          mb={3}
                        >
                          Musical Settings 🎹
                        </Text>
                      </Collapsible.Trigger>
                      <Collapsible.Content>
                        <Switch.Root
                          defaultChecked={chordMode}
                          onCheckedChange={handleChordMode}
                          mb={3}
                          colorPalette="teal"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control />
                          <HStack>
                            <Switch.Label>Chord Mode</Switch.Label>
                            <InfoTip
                              content="This determines whether a full chord is held, or a single note."
                              positioning={{ placement: "right" }}
                            />
                          </HStack>
                        </Switch.Root>
                        <Select.Root
                          collection={rootNoteOptions}
                          size="sm"
                          width="320px"
                          onChange={handleSelectRootNote}
                          mb={3}
                        >
                          <Select.HiddenSelect />
                          <Select.Label>Root Note</Select.Label>
                          <Select.Control>
                            <Select.Trigger>
                              <Select.ValueText placeholder={rootNote} />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                              <Select.Indicator />
                            </Select.IndicatorGroup>
                          </Select.Control>
                          <Select.Content>
                            {rootNoteOptions.items.map((option) => (
                              <Select.Item item={option} key={option.value}>
                                {option.label}
                                <Select.ItemIndicator />
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                        {!chordMode && (
                          <Tooltip
                            content="Pitch must be selected to use a scale."
                            openDelay={100}
                            closeDelay={100}
                            disabled={pitch}
                          >
                            <Box>
                              <Select.Root
                                collection={scaleOptions}
                                size="sm"
                                width="320px"
                                onChange={handleSelectScale}
                                mb={3}
                                disabled={!pitch}
                              >
                                <Select.HiddenSelect />
                                <Select.Label>Scale</Select.Label>

                                <Select.Control>
                                  <Select.Trigger>
                                    <Select.ValueText placeholder={scale} />
                                  </Select.Trigger>
                                  <Select.IndicatorGroup>
                                    <Select.Indicator />
                                  </Select.IndicatorGroup>
                                </Select.Control>

                                <Select.Content>
                                  {scaleOptions.items.map((option) => (
                                    <Select.Item
                                      item={option}
                                      key={option.value}
                                    >
                                      {option.label}
                                      <Select.ItemIndicator />
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>
                            </Box>
                          </Tooltip>
                        )}
                        {chordMode && (
                          <Select.Root
                            collection={qualityOptions}
                            size="sm"
                            width="320px"
                            onChange={handleSelectQuality}
                            mb={3}
                          >
                            <Select.HiddenSelect />
                            <Select.Label>Chord</Select.Label>
                            <Select.Control>
                              <Select.Trigger>
                                <Select.ValueText placeholder={"Major"} />
                              </Select.Trigger>
                              <Select.IndicatorGroup>
                                <Select.Indicator />
                              </Select.IndicatorGroup>
                            </Select.Control>
                            <Select.Content>
                              {qualityOptions.items.map((option) => (
                                <Select.Item item={option} key={option.value}>
                                  {option.label}
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Root>
                        )}
                      </Collapsible.Content>
                    </Collapsible.Root>
                  )}
                </form>
              </Box>
            </Dialog.Body>
            <Dialog.Footer display="flex" justifyContent="center">
              <Button
                width="30%"
                colorPalette="teal"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                loading={loadingCustomPreview}
                width="30%"
                colorPalette="teal"
                variant="outline"
                onClick={() => handlePreviewStyle()}
              >
                Preview
              </Button>
              <Button
                width="30%"
                colorPalette="teal"
                onClick={() => handleSubmit()}
              >
                Submit
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
}

