
import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files/files.service';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    const module: TestingModule = await Test.createTestingModule({
        providers: [FilesService],
    }).compile();

    const service = module.get<FilesService>(FilesService);
    const username = 'hasim751';
    const expectedPath = `/home/clearpanel/${username}`;

    console.log(`Checking if ${expectedPath} exists before...`);
    console.log('Exists:', fs.existsSync(expectedPath));

    console.log('Calling getDiskUsage...');
    await service.getDiskUsage(username);

    console.log(`Checking if ${expectedPath} exists after...`);
    const exists = fs.existsSync(expectedPath);
    console.log('Exists:', exists);

    if (exists) {
        console.log('SUCCESS: Directory created.');
    } else {
        console.error('FAILURE: Directory not created.');
        process.exit(1);
    }
}

run();
