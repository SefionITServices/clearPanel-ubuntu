import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControlLabel,
    Checkbox,
    Stack,
    Typography,
    Box,
} from '@mui/material';

interface PermissionsDialogProps {
    open: boolean;
    onClose: () => void;
    currentMode: string;
    fileName: string;
    onSave: (mode: string) => void;
}

export const PermissionsDialog: React.FC<PermissionsDialogProps> = ({
    open,
    onClose,
    currentMode,
    fileName,
    onSave,
}) => {
    const [mode, setMode] = useState(currentMode);

    // Parse mode string to boolean array [owner-r, owner-w, owner-x, group-r, group-w, group-x, others-r, others-w, others-x]
    const parseMode = (m: string): boolean[] => {
        const num = parseInt(m, 8);
        return [
            !!(num & 0o400), !!(num & 0o200), !!(num & 0o100), // Owner
            !!(num & 0o040), !!(num & 0o020), !!(num & 0o010), // Group
            !!(num & 0o004), !!(num & 0o002), !!(num & 0o001), // Others
        ];
    };

    const [permissions, setPermissions] = useState(parseMode(currentMode));

    const updateMode = (newPerms: boolean[]) => {
        let num = 0;
        if (newPerms[0]) num |= 0o400;
        if (newPerms[1]) num |= 0o200;
        if (newPerms[2]) num |= 0o100;
        if (newPerms[3]) num |= 0o040;
        if (newPerms[4]) num |= 0o020;
        if (newPerms[5]) num |= 0o010;
        if (newPerms[6]) num |= 0o004;
        if (newPerms[7]) num |= 0o002;
        if (newPerms[8]) num |= 0o001;
        setMode(num.toString(8).slice(-3));
    };

    const handlePermChange = (index: number) => {
        const newPerms = [...permissions];
        newPerms[index] = !newPerms[index];
        setPermissions(newPerms);
        updateMode(newPerms);
    };

    const handleSave = () => {
        onSave(mode);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Change Permissions: {fileName}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Current: {currentMode}
                    </Typography>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>Owner</Typography>
                        <Stack direction="row" spacing={2}>
                            <FormControlLabel
                                control={<Checkbox checked={permissions[0]} onChange={() => handlePermChange(0)} />}
                                label="Read"
                            />
                            <FormControlLabel
                                control={<Checkbox checked={permissions[1]} onChange={() => handlePermChange(1)} />}
                                label="Write"
                            />
                            <FormControlLabel
                                control={<Checkbox checked={permissions[2]} onChange={() => handlePermChange(2)} />}
                                label="Execute"
                            />
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>Group</Typography>
                        <Stack direction="row" spacing={2}>
                            <FormControlLabel
                                control={<Checkbox checked={permissions[3]} onChange={() => handlePermChange(3)} />}
                                label="Read"
                            />
                            <FormControlLabel
                                control={<Checkbox checked={permissions[4]} onChange={() => handlePermChange(4)} />}
                                label="Write"
                            />
                            <FormControlLabel
                                control={<Checkbox checked={permissions[5]} onChange={() => handlePermChange(5)} />}
                                label="Execute"
                            />
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>Others</Typography>
                        <Stack direction="row" spacing={2}>
                            <FormControlLabel
                                control={<Checkbox checked={permissions[6]} onChange={() => handlePermChange(6)} />}
                                label="Read"
                            />
                            <FormControlLabel
                                control={<Checkbox checked={permissions[7]} onChange={() => handlePermChange(7)} />}
                                label="Write"
                            />
                            <FormControlLabel
                                control={<Checkbox checked={permissions[8]} onChange={() => handlePermChange(8)} />}
                                label="Execute"
                            />
                        </Stack>
                    </Box>

                    <TextField
                        label="Numeric Mode"
                        value={mode}
                        onChange={(e) => {
                            setMode(e.target.value);
                            setPermissions(parseMode(e.target.value));
                        }}
                        fullWidth
                        variant="outlined"
                        helperText="Enter octal notation (e.g., 644, 755)"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Apply</Button>
            </DialogActions>
        </Dialog>
    );
};
