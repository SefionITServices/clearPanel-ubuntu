import React from 'react';
import {
    AppBar,
    Box,
    Breadcrumbs,
    IconButton,
    InputAdornment,
    Link,
    Stack,
    TextField,
    Toolbar,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material';
import {
    ArrowUpward,
    Close,
    GridView,
    Home,
    Refresh,
    Search,
    Settings,
    ViewList,
} from '@mui/icons-material';

interface FileManagerToolbarProps {
    currentPath: string;
    onNavigate: (path: string) => void;
    onRefresh: () => void;
    viewMode: 'list' | 'grid';
    onViewModeChange: (mode: 'list' | 'grid') => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSettingsClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export const FileManagerToolbar: React.FC<FileManagerToolbarProps> = ({
    currentPath,
    onNavigate,
    onRefresh,
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchChange,
    onSettingsClick,
}) => {
    const pathParts = currentPath ? currentPath.split('/') : [];

    return (
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Toolbar variant="dense" sx={{ gap: 2, minHeight: 56 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, overflow: 'hidden' }}>
                    <IconButton size="small" disabled={!currentPath} onClick={() => onNavigate(pathParts.slice(0, -1).join('/'))}>
                        <ArrowUpward fontSize="small" />
                    </IconButton>

                    <Breadcrumbs
                        maxItems={4}
                        itemsBeforeCollapse={2}
                        sx={{
                            '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
                            flexGrow: 1,
                            overflow: 'hidden'
                        }}
                    >
                        <Link
                            component="button"
                            variant="body2"
                            onClick={() => onNavigate('')}
                            underline="hover"
                            color="inherit"
                            sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}
                        >
                            <Home fontSize="small" sx={{ mr: 0.5 }} /> Home
                        </Link>
                        {pathParts.map((part, index) => {
                            const path = pathParts.slice(0, index + 1).join('/');
                            const isLast = index === pathParts.length - 1;
                            return (
                                <Link
                                    key={path}
                                    component="button"
                                    variant="body2"
                                    onClick={() => onNavigate(path)}
                                    underline="hover"
                                    color={isLast ? 'text.primary' : 'inherit'}
                                    fontWeight={isLast ? 'bold' : 'normal'}
                                    sx={{ whiteSpace: 'nowrap' }}
                                >
                                    {part}
                                </Link>
                            );
                        })}
                    </Breadcrumbs>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <TextField
                        size="small"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        sx={{
                            width: { xs: 120, sm: 200 },
                            '& .MuiOutlinedInput-root': { height: 32, pr: 0.5 }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => onSearchChange('')} sx={{ p: 0.5 }}>
                                        <Close fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <ToggleButtonGroup
                        size="small"
                        value={viewMode}
                        exclusive
                        onChange={(_, newMode) => newMode && onViewModeChange(newMode)}
                        aria-label="view mode"
                        sx={{ height: 32 }}
                    >
                        <ToggleButton value="list" aria-label="list view">
                            <ViewList fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="grid" aria-label="grid view">
                            <GridView fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={onRefresh}>
                            <Refresh fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Settings">
                        <IconButton size="small" onClick={onSettingsClick}>
                            <Settings fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Toolbar>
        </AppBar>
    );
};
