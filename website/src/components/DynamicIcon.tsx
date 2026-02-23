'use client';
// Dynamic MUI icon loader — maps icon name strings from content files to actual MUI icon components
import * as Icons from '@mui/icons-material';
import { SvgIconProps } from '@mui/material';

interface DynamicIconProps extends SvgIconProps {
    name: string;
}

type MuiIcons = typeof Icons;

export default function DynamicIcon({ name, ...props }: DynamicIconProps) {
    const IconComponent = (Icons as MuiIcons)[name as keyof MuiIcons] as React.ElementType | undefined;
    if (!IconComponent) return <Icons.HelpOutline {...props} />;
    return <IconComponent {...props} />;
}
