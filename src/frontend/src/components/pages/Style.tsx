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

export default function Style() {

    const navigate = useNavigate();

    interface BaseSound { 
        name: string
        composable: boolean
        downloaded: boolean
    };

    const defaultSound: BaseSound = {
        name: 'Default Synth 🎹',
        composable: true,
        downloaded: true
    }

    // State to manage the dialog open/close
    const [open, setOpen] = useState(false);

    // Suggested styles
    const [variants, setVariants] = useState<any[]>([]);

    // Reference to the file input
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        fetch(`${coreAPI}/styles/light_curves`)
            .then((res) => res.json())
            .then((data) => {
                data.push({'name': 'Custom'})
                setVariants(data);
                console.log(variants)
            })
            .catch((err) => {
                console.error("Failed to fetch presets:", err);
            });
    }, []);

    useEffect(() => {

        setLoadingSounds(true)

        const fetchSounds = async () => {
            try {
                const response = await fetch(`${coreAPI}/sound_info/`)

                if (!response.ok) {
                    throw new Error('Failed to fetch sounds');
                    }
                const soundsData: BaseSound[] = await response.json();

                const collection = createListCollection({
                    items: soundsData.map(sound => ({
                        ...sound,
                        label: `${sound.name}${sound.composable ? ' 🎹' : ''}`,  // Add piano emoji for composable sounds
                        value: sound.name
                    }))
                });
                setSoundOptions(collection);
            } catch (error) {
                console.error('Error fetching sounds:', error);
            } finally {
                setLoadingSounds(false);
            }
        }

        fetchSounds();
    }, []);



    // Sound parameters for sonification
    const [sound, setSound] = useState<BaseSound>(defaultSound);
    const [filterCutoff, setFilterCutoff] = useState<boolean | 'indeterminate'>(false);
    const [pitch, setPitch] = useState(false);
    const [volume, setVolume] = useState(false);
    const [leftRightPan, setLeftRightPan] = useState(false);
    const [chordMode, setChordMode] = useState(false);
    const [rootNote, setRootNote] = useState('C');
    const [scale, setScale] = useState('None');
    const [quality, setQuality] = useState('Major');
    const [soundOptions, setSoundOptions] = useState(
        createListCollection<BaseSound & { label: string; value: string }>({ items: [] })
    );
    const [loadingSounds, setLoadingSounds] = useState(true);
    const [loadingCustomPreview, setLoadingCustomPreview] = useState(false)

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
            { label: "Harmonic Minor", value: "harmonic minor" },
            { label: "Pentatonic", value: "pentatonic minor" },
            { label: "Blues", value: "blues" },
            { label: "Chromatic", value: "chromatic" },
            { label: "Flamenco", value: "flamenco" },
            { label: "Romani", value: "romani" },
            { label: "Hirajoshi", value: "hijaroshi" },
            { label: "Persian", value: "persian" },
            { label: "Phrygian Dominant", value: "phrygian dominant" },           
        ],
    });
    const qualityOptions = createListCollection({
        //maj, min, maj7, maj9, 5, 6, 7, 9, m7, m9, sus2, sus4, 7sus4, add9, madd9
        items: [
            { label: "Major", value: "maj" },
            { label: "Minor", value: "min" },
            { label: "Major 7", value: "maj7" },
            { label: "Major 9", value: "maj9" },
            { label: "5", value: "5" },
            { label: "6", value: "6" },
            { label: "7", value: "7" },
            { label: "9", value: "9" },
            { label: "Minor 7", value: "m7" },
            { label: "Minor 9", value: "m9" },
            { label: "Sus2", value: "sus2" },
            { label: "Sus4", value: "sus4" },
            { label: "7sus4", value: "7sus4" },
            { label: "Add9", value: "add9" },
            { label: "Minor Add9", value: "madd9" },
        ],
    });
    const parameters = ["Filter Cutoff", "Pitch", "Volume", "Left/Right Pan"] as const;

    const location = useLocation();
    const dataFilepath = location.state.dataFilepath;
    const soniType = location.state.soniType;
    
    console.log("Filepath of Selected Lightcurve:", dataFilepath);
    
    const saveSoundSettings = async () => {

        const save_sound_settings_url = `${coreAPI}/save-sound-settings/`;

        const response = await fetch(save_sound_settings_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                "sound": sound.name.replace(/\s*🎹$/, ""),
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

    const handleClick  = async (style: any) => {
        if (style.name === "Custom") {
            console.log("Custom sound settings selected, opening dialog...");
            setOpen(true);
        } else {
            console.log("Selected style:", style.name);
            const styleFilepath = style.filepath;
            console.log("Filepath of selected style:", styleFilepath);
            // Navigate to the Sonify page with the selected style
            navigate('/sonify', { state: { dataFilepath, styleFilepath, soniType } });
        }
    }

    const ensureSoundAvailable = async (soundName: string) => {
        // ensure the sound is available by downloading if necessary
        await fetch(`${coreAPI}/ensure-sound-available/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sound_name: soundName }),
        });
    }

    const handlePreviewStyle = async () => {
        try {
            setLoadingCustomPreview(true)
            ensureSoundAvailable(sound.name);

            // Wait for sound settings to save and get filepath
            const filepath = await saveSoundSettings();
            console.log("Saved sound settings to:", filepath);

            const preview_endpoint = `${coreAPI}/preview-style-settings/light_curves`;

            const response = await fetch(preview_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    style_filepath: filepath 
                }),
            });

            const data = await response.json();
            const audioUrl = `${coreAPI}/audio/${data.filename}`;
            const preview = new Audio(audioUrl);
            preview.play()
            setLoadingCustomPreview(false)

        } catch (err) {
            console.error("Error previewing style settings:", err);
        }
    };



    const handleSubmit = async () => {
    try {
        ensureSoundAvailable(sound.name)
        // save sound settings
        saveSoundSettings().then((styleFilepath) => {
            console.log("Saved sound settings to:", styleFilepath);
            // navigate
            navigate('/sonify', { state: { dataFilepath, styleFilepath, soniType } });
        });
    } catch (err) {
        console.error("Error saving style settings:", err);
    }
    };


    const handleChangeFilterCutoff = (details: { checked: boolean | "indeterminate" }) => {
        setFilterCutoff(details.checked);
        //setSettings((prev) => ({ ...prev, FilterCutoff: details.checked === true }));
        console.log("Filter Cutoff:", details.checked);
    };

    const handleChangePitch = (details: { checked: boolean | "indeterminate" }) => {
    console.log("handleChangePitch called with:", details);
    console.log("details.checked === false:", details.checked === false);
    console.log("Current scale before:", scale);
    
    setPitch(details.checked === true);
    
    if (details.checked === false) {
        console.log("Setting scale to None");
        setScale('None');
        console.log('Scale: ' + scale)
    }
    
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

    const handleSelectSound = (details: { value: string[] }) => {
        if (details.value && details.value.length > 0) {
            const selectedSoundName = details.value[0];
            
            // Find the full object from soundOptions
            const selectedSoundItem = soundOptions.items.find(item => item.value === selectedSoundName);
            
            if (selectedSoundItem) {
                setSound(selectedSoundItem);
                console.log("Selected Sound:", selectedSoundItem);
            }
        }
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
        console.log("Selected Scale:", target.value);
    };

    const handleSelectQuality = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setQuality(target.value);
        //setSettings((prev) => ({ ...prev, Quality: target.value }));
        console.log("Selected Quality:", target.value);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onFileSelect(file); // Send file to parent or upload logic
        }
    };

    const onFileSelect = async (file: File) => {
        console.log("File selected:", file);
        // You can handle the file upload logic here
        // For example, you can upload the file to the server or process it
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${coreAPI}/upload-yaml/`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            //setFilepath(data.filepath); // Save the filepath returned by the server
            console.log("File uploaded successfully:", data.filepath);
            const styleFilepath = data.filepath;
            // Navigate to the Sonify page with the uploaded file
            navigate('/sonify', { state: { dataFilepath, styleFilepath, soniType } });
            //setResponse(data);
        } catch (err: any) {
            //setResponse({ error: err.message });
        }
        
    }

    const handleButtonClick = () => {
        console.log("Upload Custom YAML File clicked");
        inputRef.current?.click(); // Programmatically open file dialog
    };

    return (
        <PageContainer>
            <Box position='relative' as="main" role="main">
                <Heading size="4xl">  Step 2: Style</Heading>
                <br />
                <Text textStyle="lg">Choose from the styles below, or configure your own.</Text>
                <br />
                <Dialog.Root lazyMount open={open} placement='center' onOpenChange={(details) => setOpen(details.open)}>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                    <Dialog.Content>
                        <Dialog.Header>
                            <Dialog.Title>Custom Style</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <input type="file" ref={inputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".yml" />
                            <Tooltip content='Upload your own config file' positioning={{placement: 'right'}}>
                                <Button colorPalette='teal' onClick={handleButtonClick}>Upload Custom YAML File</Button>
                            </Tooltip>
                            <form>
                            <br />
                            <Select.Root collection={soundOptions} size="sm" width="320px" onValueChange={handleSelectSound}>
                                <Select.HiddenSelect />
                                <HStack>
                                    <Select.Label>Base Sound</Select.Label>
                                    <InfoTip content="This is the underlying sound (or instrument) that is used as a basis for the sonification." positioning={{placement:'right'}}/>
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
                                <Text fontWeight='medium'>Parameters</Text>
                                <InfoTip content='These are the aspects of the sound that will be controlled by the data.' positioning={{placement: 'right'}}/>
                            </HStack>
                            
                            <br />
                            <Stack gap="4" direction="row" wrap="wrap">
                                <Checkbox.Root key={parameters[0]} checked={filterCutoff} onCheckedChange={handleChangeFilterCutoff} colorPalette='teal'>
                                    <Checkbox.HiddenInput />
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <Checkbox.Label>{parameters[0]}</Checkbox.Label>
                                </Checkbox.Root>
                                <Checkbox.Root key={parameters[1]} checked={pitch} onCheckedChange={handleChangePitch} colorPalette='teal'>
                                    <Checkbox.HiddenInput />
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <Checkbox.Label>{parameters[1]}</Checkbox.Label>
                                </Checkbox.Root>
                                <Checkbox.Root key={parameters[2]} checked={volume} onCheckedChange={handleChangeVolume} colorPalette='teal'>
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
                            {sound.composable && 
                                <Collapsible.Root transition="opacity 0.3s ease-in-out">
                                    <Collapsible.Trigger>
                                        <Text color='teal' fontWeight='medium' cursor='pointer' mb={3}>Musical Settings 🎹</Text>
                                    </Collapsible.Trigger>
                                    <Collapsible.Content>
                                            <Switch.Root defaultChecked={chordMode} onCheckedChange={handleChordMode} mb={3} colorPalette='teal'>
                                                <Switch.HiddenInput />
                                                <Switch.Control />
                                                <HStack>
                                                    <Switch.Label>Chord Mode</Switch.Label>
                                                    <InfoTip content='This determines whether a full chord is held, or a single note.' positioning={{placement: 'right'}}/>
                                                </HStack>
                                            </Switch.Root>
                                            <Select.Root collection={rootNoteOptions} size="sm" width="320px" onChange={handleSelectRootNote} mb={3}>
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
                                            {!chordMode &&
                                            <Tooltip content='Pitch must be selected to use a scale.' openDelay={100} closeDelay={100} disabled={pitch}>
                                                <Box>
                                                    <Select.Root collection={scaleOptions} size="sm" width="320px" onChange={handleSelectScale} mb={3} disabled={!pitch}>
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
                                                </Box>
                                            </Tooltip>
                                            }
                                            {chordMode && <Select.Root collection={qualityOptions} size="sm" width="320px" onChange={handleSelectQuality} mb={3}>
                                                <Select.HiddenSelect />
                                                <Select.Label>Chord</Select.Label>
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
                                    </Collapsible.Content>
                                </Collapsible.Root>
                            }
                        </form>
                        </Dialog.Body>
                        <Dialog.Footer display="flex" justifyContent="center">
                            <Button width='30%' colorPalette='teal' variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button loading={loadingCustomPreview} width='30%' colorPalette='teal' variant="outline" onClick={() => handlePreviewStyle()}>Preview</Button>
                            <Button width='30%' colorPalette='teal' onClick={() => handleSubmit()}>Submit</Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                    </Dialog.Positioner>
                    </Dialog.Root>

                <Stack gap="6" direction="row" wrap="wrap" animation="fade-in 300ms ease-out">
                    {variants.map((variant, index) => {
                        const gradientClasses = ['gradient-aurora', 'gradient-neon', 'gradient-darkwave', 'gradient-sunset', 'gradient-ocean', 'gradient-forest'];
                        const gradientClass = variant.name === 'Custom' ? 'gradient-custom' : gradientClasses[index % gradientClasses.length];

                        return (
                        <Box
                            key={variant.name} 
                            onClick={() => handleClick(variant)} 
                            style={{ cursor: 'pointer', width: 200 }}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleClick(variant);
                                }}
                            }
                            >
                            <StyleCard title={variant.name} gradientClass={gradientClass} isCustom={variant.name === 'Custom'}/>
                        </Box>
                        );
                    })}
                </Stack>
            </Box>
        </PageContainer>
    )
}