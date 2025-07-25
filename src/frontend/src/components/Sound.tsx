import React, { useEffect, useState, createContext, ChangeEvent, useRef } from "react";
import { data, useLocation, useNavigate } from 'react-router-dom';

import {
  Box,
  Button,
  Card,
  Checkbox,
  createListCollection,
  Dialog,
  Link,
  LinkBox,
  LinkOverlay,
  Select,
  Stack,
  Switch,  
} from "@chakra-ui/react";

export default function Sound() {

    const navigate = useNavigate();
    // State to manage the dialog open/close
    const [open, setOpen] = useState(false);
    // Musical types of sonification
    const variants = [
        {
            name: "Sci-Fi",
            filepath: "C:\\Users\\plant\\Projects\\sonification-toolkit\\src\\style_files\\light_curve\\sci_fi.yml",
        },
        {
            name: "Windy",
            filepath: "C:\\Users\\plant\\Projects\\sonification-toolkit\\src\\style_files\\light_curve\\windy.yml",
        },
        {
            name: "Musical",
            filepath: "C:\\Users\\plant\\Projects\\sonification-toolkit\\src\\style_files\\light_curve\\musical.yml",
        },
        {
            name: "Custom",
            filepath: "",
        }
    ] as const;
    // Sound parameters for sonification
    const [sound, setSound] = useState('default_synth');
    const [filterCutoff, setFilterCutoff] = useState<boolean | 'indeterminate'>(false);
    const [pitch, setPitch] = useState(false);
    const [volume, setVolume] = useState(false);
    const [leftRightPan, setLeftRightPan] = useState(false);
    const [chordMode, setChordMode] = useState(false);
    const [rootNote, setRootNote] = useState('C');
    const [scale, setScale] = useState('None');
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
            { label: "None", value: "None" },
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
    //const [settings, setSettings] = useState([])
    const location = useLocation();
    const dataFilepath = location.state;
    console.log("Filepath of Selected Lightcurve:", dataFilepath);
    const saveSoundSettings = async () => {
        const save_sound_settings_url = "http://localhost:8000/save-sound-settings/";
        const response = await fetch(save_sound_settings_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                "sound": sound,
                "filterCutOff": filterCutoff,
                "pitch": pitch,
                "volume": volume,
                "leftRightPan": leftRightPan,
                "chordMode": chordMode,
                "rootNote": rootNote,
                "scale": scale,
                "quality": quality 
            }),
        });
        const data = await response.json();
        return data.filepath;
    }

    const handleClick  = async (variant: any) => {
        if (variant.name === "Custom") {
            console.log("Custom sound settings selected, opening dialog...");
            setOpen(true);
        } else {
            console.log("Selected variant:", variant.name);
            const filepath = variant.filepath;
            console.log("Filepath of selected variant:", filepath);
            // Navigate to the Sonify page with the selected variant
            navigate('/sonify', { state: { filepath, dataFilepath } });
        }
    }

    const handleSubmit  = async () => {
        saveSoundSettings().then((filepath) => {
            console.log("Saved sound settings to:", filepath);
            // Navigate to the Sonify page with the settings
            navigate('/sonify', { state: { filepath, dataFilepath } });
        });
    };

    const handleChangeFilterCutoff = (details: { checked: boolean | "indeterminate" }) => {
        setFilterCutoff(details.checked);
        //setSettings((prev) => ({ ...prev, FilterCutoff: details.checked === true }));
        console.log("Filter Cutoff:", details.checked);
    };

    const handleChangePitch = (details: { checked: boolean | "indeterminate" }) => {
        setPitch(details.checked === true);
        //setSettings((prev) => ({ ...prev, Pitch: details.checked === true }));
        console.log("Pitch:", details.checked);
    };

    const handleChangeVolume = (details: { checked: boolean | "indeterminate" }) => {
        setVolume(details.checked === true);
        //setSettings((prev) => ({ ...prev, Volume: details.checked === true }));
        console.log("Volume:", details.checked);
    };

    const handleChangeLeftRightPan = (details: { checked: boolean | "indeterminate" }) => {
        setLeftRightPan(details.checked === true);
        //setSettings((prev) => ({ ...prev, LeftRightPan: details.checked === true }));
        console.log("Left/Right Pan:", details.checked);
    };

    const handleSelectSound = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setSound(target.value);
        //setSettings((prev) => ({ ...prev, Sound: target.value }));
        console.log("Selected Sound:", target.value);
    };

    const handleChordMode = (details: { checked: boolean | "indeterminate" }) => {
        setChordMode(details.checked === true);
        //setSettings((prev) => ({ ...prev, ChordMode: details.checked === true }));
        console.log("Chord Mode:", details.checked);
    };

    const handleSelectRootNote = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setRootNote(target.value);
        //setSettings((prev) => ({ ...prev, RootNote: target.value }));
        console.log("Selected Root Note:", target.value);
    };

    const handleSelectScale = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setScale(target.value);
        setPitch(target.value !== 'None');
        // If scale is selected, enable pitch
        //setSettings((prev) => ({ ...prev, Scale: target.value }));
        console.log("Selected Scale:", target.value);
    };

    const handleSelectQuality = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setQuality(target.value);
        //setSettings((prev) => ({ ...prev, Quality: target.value }));
        console.log("Selected Quality:", target.value);
    };

    return (
        <Box>
            <h1>Sound</h1>
            <br />

            <Dialog.Root lazyMount open={open} onOpenChange={(details) => setOpen(details.open)}>
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
                        {!chordMode && <Select.Root collection={scaleOptions} size="sm" width="320px" onChange={handleSelectScale}>
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
                        </Select.Root>}
                        {chordMode && <Select.Root collection={qualityOptions} size="sm" width="320px" onChange={handleSelectQuality}>
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
                        </Select.Root>}
                        <Button onClick={() => handleSubmit()} colorScheme="blue" width="100%">
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
                    <LinkBox as="article" maxW="sm" borderWidth="1px" rounded="md" overflow="hidden">
                        <Card.Root width="200px" key={variant.name}>
                            <LinkOverlay as={Link} onClick={() => {handleClick(variant)}}>
                                <img src={`/assets/${variant.name}.jpg`} alt={variant.name} style={{ width: "100%", borderRadius: "8px" }} />
                            </LinkOverlay>
                            <Card.Body gap="2">
                                <Card.Title mb="2">{variant.name}</Card.Title>
                            </Card.Body>
                        </Card.Root>
                    </LinkBox>
                    
                ))}
            </Stack>
        </Box>

    )
}