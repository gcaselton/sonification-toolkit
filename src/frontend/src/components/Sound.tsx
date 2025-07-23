import React, { useEffect, useState, createContext, ChangeEvent, useRef } from "react";
import { useLocation } from 'react-router-dom';

import {
  Box,
  Button,
  Card,
  Checkbox,
  createListCollection,
  Dialog,
  Select,
  Stack,
  Switch,  
} from "@chakra-ui/react";

interface Settings {
    Sound: string;
    FilterCutoff: boolean;
    Pitch: boolean;
    Volume: boolean;
    LeftRightPan: boolean;
    UpDownPan: boolean;
    Vibrato: boolean;
}

export default function Sound() {

    // Musical types of sonification
    const variants = ["Sci-Fi", "Windy", "Musical", "Custom"] as const;
    // Sound parameters for sonification
    const [sound, setSound] = useState('default_synth');
    const [filterCutoff, setFilterCutoff] = useState<boolean | 'indeterminate'>(false);
    const [pitch, setPitch] = useState(false);
    const [volume, setVolume] = useState(false);
    const [leftRightPan, setLeftRightPan] = useState(false);
    const [chordMode, setChordMode] = useState(false);
    const [rootNote, setRootNote] = useState('C');
    const [scale, setScale] = useState('major');
    const [quality, setQuality] = useState('maj');
    const soundOptions = createListCollection({
        items: [
            { label: "default_synth", value: "default_synth" },
            { label: "windy", value: "windy" },
        ],
    });
    const rootNoteOptions = createListCollection({
        items: [
            //C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B
            { label: "C", value: "C" },
            { label: "C#/Db", value: "C#/Db" },
            { label: "D", value: "D" },
            { label: "D#/Eb", value: "D#/Eb" },
            { label: "E", value: "E" },
            { label: "F", value: "F" },
            { label: "F#/Gb", value: "F#/Gb" },
            { label: "G", value: "G" },
            { label: "G#/Ab", value: "G#/Ab" },
            { label: "A", value: "A" },
            { label: "A#/Bb", value: "A#/Bb" },
            { label: "B", value: "B" },
        ],
    });
    const scaleOptions = createListCollection({
        items: [
            { label: "Major", value: "major" },
            { label: "Minor", value: "minor" },
            { label: "Augmented", value: "augmented" },
            { label: "Blues", value: "blues" },
            { label: "Chromatic", value: "chromatic" },
            { label: "Dorian", value: "dorian" },
            { label: "Flamenco", value: "flamenco" },
            { label: "Romani", value: "romani" },
            { label: "Harmonic Major", value: "harmonic_major" },
            { label: "Harmonic Minor", value: "harmonic_minor" },
            { label: "Hijaroshi", value: "hijaroshi" },
            { label: "Locrian", value: "locrian" },
            { label: "Lydian", value: "lydian" },
            { label: "Mixolydian", value: "mixolydian" },
            { label: "Pentatonic Major", value: "pentatonic_major" },
            { label: "Pentatonic Minor", value: "pentatonic_minor" },
            { label: "Persian", value: "persian" },
            { label: "Phrygian Dominant", value: "phygrian_dominant" },
            { label: "Phygrian", value: "phygrian" },            
        ],
    });
    const qualityOptions = createListCollection({
        //maj, min, maj7, maj9, 5, 6, 7, 9, m7, m9, sus2, sus4, 7sus4, add9, madd9
        items: [
            { label: "maj", value: "maj" },
            { label: "min", value: "min" },
            { label: "maj7", value: "maj7" },
            { label: "maj9", value: "maj9" },
            { label: "5", value: "5" },
            { label: "6", value: "6" },
            { label: "7", value: "7" },
            { label: "9", value: "9" },
            { label: "m7", value: "m7" },
            { label: "m9", value: "m9" },
            { label: "sus2", value: "sus2" },
            { label: "sus4", value: "sus4" },
            { label: "7sus4", value: "7sus4" },
            { label: "add9", value: "add9" },
            { label: "madd9", value: "madd9" },
        ],
    });
    const parameters = ["Filter Cutoff", "Pitch", "Volume", "Left/Right Pan", "Up/Down Pan", "Vibrato"] as const;

    /*const settings: Settings = {
        Sound: "Sci-Fi",
        FilterCutoff: false,
        Pitch: false,
        Volume: false,
        LeftRightPan: false,
        UpDownPan: false,
        Vibrato: false,
    };*/
    const [settings, setSettings] = useState([])
    const location = useLocation();
    const dataURI = location.state;
    console.log("Data URI from Lightcurves:", dataURI);
    const selectLightCurve = async (lightcurve: string) => {
        const select_lightcurve_url = "http://localhost:8000/select-lightcurve";
        const response = await fetch(select_lightcurve_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "data_uri": lightcurve }),
        });
        const data = await response.json();
        return data.filepath;
    }

    const handleSubmit = async () => {
        console.log("Updated Settings:", settings);
    };

    const handleChangeFilterCutoff = (details: { checked: boolean | "indeterminate" }) => {
        setFilterCutoff(details.checked);
        setSettings((prev) => ({ ...prev, FilterCutoff: details.checked === true }));
        console.log("Filter Cutoff:", details.checked);
    };

    const handleChangePitch = (details: { checked: boolean | "indeterminate" }) => {
        setPitch(details.checked === true);
        setSettings((prev) => ({ ...prev, Pitch: details.checked === true }));
        console.log("Pitch:", details.checked);
    };

    const handleChangeVolume = (details: { checked: boolean | "indeterminate" }) => {
        setVolume(details.checked === true);
        setSettings((prev) => ({ ...prev, Volume: details.checked === true }));
        console.log("Volume:", details.checked);
    };

    const handleChangeLeftRightPan = (details: { checked: boolean | "indeterminate" }) => {
        setLeftRightPan(details.checked === true);
        setSettings((prev) => ({ ...prev, LeftRightPan: details.checked === true }));
        console.log("Left/Right Pan:", details.checked);
    };

    const handleSelectSound = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setSound(target.value);
        setSettings((prev) => ({ ...prev, Sound: target.value }));
        console.log("Selected Sound:", target.value);
    };

    const handleChordMode = (details: { checked: boolean | "indeterminate" }) => {
        setChordMode(details.checked === true);
        setSettings((prev) => ({ ...prev, ChordMode: details.checked === true }));
        console.log("Chord Mode:", details.checked);
    };

    const handleSelectRootNote = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setRootNote(target.value);
        setSettings((prev) => ({ ...prev, RootNote: target.value }));
        console.log("Selected Root Note:", target.value);
    };

    const handleSelectScale = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setScale(target.value);
        setSettings((prev) => ({ ...prev, Scale: target.value }));
        console.log("Selected Scale:", target.value);
    };

    const handleSelectQuality = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setQuality(target.value);
        setSettings((prev) => ({ ...prev, Quality: target.value }));
        console.log("Selected Quality:", target.value);
    };

    return (
        <Box>
            <h1>Sound</h1>
            <br />

            <Dialog.Root>
                <Dialog.Trigger />
                <Dialog.Backdrop />
                <Dialog.Positioner>
                <Dialog.Content>
                    <Dialog.CloseTrigger />
                    <Dialog.Header>
                    <Dialog.Title />
                    Custom Style
                    </Dialog.Header>
                    <Dialog.Body>
                        <form>
                        <Select.Root collection={soundOptions} size="sm" width="320px" onChange={handleSelectSound}>
                            <Select.HiddenSelect />
                            <Select.Label>Sound</Select.Label>
                            <Select.Control>
                                <Select.Trigger>
                                <Select.ValueText placeholder={sound} />
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
                        <label>Parameters</label>
                        <Stack gap="4" direction="row" wrap="wrap">
                            <Checkbox.Root key={parameters[0]} checked={filterCutoff} onCheckedChange={handleChangeFilterCutoff}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Label>{parameters[0]}</Checkbox.Label>
                            </Checkbox.Root>
                            <Checkbox.Root key={parameters[1]} checked={pitch} onCheckedChange={handleChangePitch}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Label>{parameters[1]}</Checkbox.Label>
                            </Checkbox.Root>
                            <Checkbox.Root key={parameters[2]} checked={volume} onCheckedChange={handleChangeVolume}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Label>{parameters[2]}</Checkbox.Label>
                            </Checkbox.Root>
                            <Checkbox.Root key={parameters[3]} defaultChecked={leftRightPan} onCheckedChange={handleChangeLeftRightPan}>
                                <Checkbox.HiddenInput />
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Label>{parameters[3]}</Checkbox.Label>
                            </Checkbox.Root>
                        </Stack>
                        <Switch.Root defaultChecked={chordMode} onCheckedChange={handleChordMode}>
                            <Switch.HiddenInput />
                            <Switch.Control />
                            <Switch.Label>Chord Mode</Switch.Label>
                        </Switch.Root>
                        <Select.Root collection={rootNoteOptions} size="sm" width="320px" onChange={handleSelectRootNote}>
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
                        <Select.Root collection={scaleOptions} size="sm" width="320px" onChange={handleSelectScale}>
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
                                    <Select.Item item={option} key={option.value}>
                                        {option.label}
                                        <Select.ItemIndicator />
                                    </Select.Item>
                                    ))}
                                </Select.Content>
                        </Select.Root>
                        <Select.Root collection={qualityOptions} size="sm" width="320px" onChange={handleSelectQuality}>
                            <Select.HiddenSelect />
                            <Select.Label>Quality</Select.Label>
                            <Select.Control>
                                <Select.Trigger>
                                <Select.ValueText placeholder={quality} />
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
                        <Button type="button" colorScheme="blue" width="100%" onClick={handleSubmit}>
                            Submit
                        </Button>
                    </form>
                    </Dialog.Body>
                    <Dialog.Footer />
                </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            <Stack gap="4" direction="row" wrap="wrap">
                {variants.map((variant) => (
                    <Card.Root width="200px" key={variant}>
                    <img src={`/assets/${variant}.jpg`} alt={variant} style={{ width: "100%", borderRadius: "8px" }} />
                    <Card.Body gap="2">
                        <Card.Title mb="2">{variant}</Card.Title>
                    </Card.Body>
                    </Card.Root>
                ))}
            </Stack>
        </Box>

    )
}