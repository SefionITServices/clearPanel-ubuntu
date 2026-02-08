import React from 'react';
import {
    InsertDriveFile,
    Folder,
    Image,
    Description,
    Code,
    MusicNote,
    Movie,
    TableChart,
    Slideshow,
    Archive,
} from '@mui/icons-material';
import { SvgIconProps } from '@mui/material';

interface FileIconProps extends SvgIconProps {
    fileName: string;
    isDirectory?: boolean;
}

export const FileIcon: React.FC<FileIconProps> = ({ fileName, isDirectory, ...props }) => {
    if (isDirectory) {
        return <Folder color="primary" {...props} />;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (extension) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
        case 'webp':
            return <Image color="secondary" {...props} />;
        case 'pdf':
        case 'doc':
        case 'docx':
        case 'txt':
        case 'md':
            return <Description color="action" {...props} />;
        case 'js':
        case 'ts':
        case 'tsx':
        case 'jsx':
        case 'html':
        case 'css':
        case 'json':
        case 'py':
        case 'java':
        case 'c':
        case 'cpp':
            return <Code color="action" {...props} />;
        case 'mp3':
        case 'wav':
        case 'ogg':
            return <MusicNote color="secondary" {...props} />;
        case 'mp4':
        case 'webm':
        case 'avi':
        case 'mov':
            return <Movie color="secondary" {...props} />;
        case 'xls':
        case 'xlsx':
        case 'csv':
            return <TableChart color="success" {...props} />;
        case 'ppt':
        case 'pptx':
            return <Slideshow color="warning" {...props} />;
        case 'zip':
        case 'tar':
        case 'gz':
        case 'rar':
        case '7z':
            return <Archive color="warning" {...props} />;
        default:
            return <InsertDriveFile color="action" {...props} />;
    }
};
