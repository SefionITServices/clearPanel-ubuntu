import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    TextField,
    RadioGroup,
    FormControlLabel,
    Radio,
    Box,
    Alert,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

interface ConflictDialogProps {
    open: boolean;
    onClose: () => void;
    fileName: string;
    onResolve: (action: 'replace' | 'rename', newName?: string) => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
    open,
    onClose,
    fileName,
    onResolve,
}) => {
    const [action, setAction] = useState<'replace' | 'rename'>('rename');
    const [newName, setNewName] = useState(() => {
        const parts = fileName.split('.');
        if (parts.length > 1) {
            const ext = parts.pop();
            const baseName = parts.join('.');
            return `_${baseName}_copy.${ext}`;
        }
        return `_${fileName}_copy`;
    });

    const handleConfirm = () => {
        if (action === 'replace') {
            onResolve('replace');
        } else {
            onResolve('rename', newName);
        }
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box display="flex" alignItems="center" gap={1}>
                    <Warning color="warning" />
                    <Typography variant="h6">File Already Exists</Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Alert severity="warning" sx={{ mb: 3 }}>
                    A file named <strong>{fileName}</strong> already exists in this location.
                </Alert>

                <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
                    How would you like to proceed?
                </Typography>

                <RadioGroup value={action} onChange={(e) => setAction(e.target.value as 'replace' | 'rename')}>
                    <FormControlLabel
                        value="replace"
                        control={<Radio />}
                        label={
                            <Box>
                                <Typography variant="body1">Replace existing file</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Overwrite the existing file with the new one
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        value="rename"
                        control={<Radio />}
                        label={
                            <Box>
                                <Typography variant="body1">Keep both (rename new file)</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Save as a different name
                                </Typography>
                            </Box>
                        }
                    />
                </RadioGroup>

                {action === 'rename' && (
                    <Box sx={{ mt: 2, ml: 4 }}>
                        <TextField
                            fullWidth
                            label="New file name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            variant="outlined"
                            size="small"
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleConfirm} variant="contained" color="primary">
                    Continue
                </Button>
            </DialogActions>
        </Dialog>
    );
};
