import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import GitHubIcon from '@mui/icons-material/GitHub';
import TerminalIcon from '@mui/icons-material/Terminal';
import { gitApi, FrameworkDetectionResult, ManagedRepo } from '../../api/git';

interface QuickDeployModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (repo: ManagedRepo) => void;
}

export const QuickDeployModal: React.FC<QuickDeployModalProps> = ({ open, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [repoUrl, setRepoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [gitUser, setGitUser] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [autoDeployWebhook, setAutoDeployWebhook] = useState(true);

  // Detection & Script State
  const [detection, setDetection] = useState<FrameworkDetectionResult | null>(null);
  const [deployScript, setDeployScript] = useState('');
  const [generatedWorkflow, setGeneratedWorkflow] = useState('');
  const [copied, setCopied] = useState(false);
  const [cicdTab, setCicdTab] = useState(0);

  // Result state
  const [deployedRepo, setDeployedRepo] = useState<ManagedRepo | null>(null);
  const [deployLog, setDeployLog] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartDeploy = async () => {
    if (!repoUrl) {
      setError('Please provide a Git repository URL.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await gitApi.quickDeploy({
        url: repoUrl.trim(),
        name: projectName.trim() || undefined,
        dest: targetPath.trim() || undefined,
        gitUser: gitUser.trim() || undefined,
        token: gitToken.trim() || undefined,
        customDeployScript: deployScript || undefined,
        autoDeploy: autoDeployWebhook,
      });

      if (res.success) {
        setDeployedRepo(res.repo);
        setDetection(res.detection);
        if (res.detection?.suggestedDeployScript && !deployScript) {
          setDeployScript(res.detection.suggestedDeployScript);
        }

        if (res.webhook) {
          setWebhookUrl(res.webhook.webhookUrl);
          setWebhookSecret(res.webhook.webhookSecret);
        }

        if (res.deployResult?.output) {
          setDeployLog(res.deployResult.output);
        }

        // Generate matching GitHub Actions YAML
        const wf = await gitApi.generateWorkflow({
          projectName: projectName || res.repo.name || 'ClearPanel App',
          branch: 'main',
          deployMethod: 'webhook',
          webhookUrl: res.webhook?.webhookUrl,
          webhookSecret: res.webhook?.webhookSecret,
          buildCommand: res.detection?.suggestedBuildCommand,
        });

        if (wf.success) {
          setGeneratedWorkflow(wf.workflow);
        }

        setActiveStep(2); // Jump to Results & CI/CD tab
        onSuccess(res.repo);
      }
    } catch (err: any) {
      setError(err.message || 'Deployment failed. Please verify repository URL and permissions.');
    } finally {
      setBusy(false);
    }
  };

  const resetModal = () => {
    setActiveStep(0);
    setError(null);
    setRepoUrl('');
    setProjectName('');
    setTargetPath('');
    setGitUser('');
    setGitToken('');
    setDetection(null);
    setDeployScript('');
    setGeneratedWorkflow('');
    setDeployedRepo(null);
    setDeployLog('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={resetModal} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <RocketLaunchIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Deploy Any Project & Auto-Set CI/CD
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Connect any Git repository — ClearPanel auto-detects framework, builds recipe, and sets up CI/CD
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={resetModal} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* STEP 1: Repository Details */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              1. Git Repository Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Enter the Git repository URL for your project (GitHub, GitLab, Bitbucket, or self-hosted Git).
            </Typography>

            <Stack spacing={2.5}>
              <TextField
                label="Git Repository URL"
                placeholder="https://github.com/username/my-project.git"
                fullWidth
                size="small"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  if (!projectName) {
                    const match = e.target.value.match(/\/([^/]+?)(?:\.git)?$/);
                    if (match) setProjectName(match[1]);
                  }
                }}
                required
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Project Name"
                  placeholder="my-app"
                  fullWidth
                  size="small"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
                <TextField
                  label="Target Subfolder (Optional)"
                  placeholder="e.g. apps/my-app or leave empty"
                  fullWidth
                  size="small"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                />
              </Stack>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
                  Authentication (Only required for Private Repositories)
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    label="Git Username"
                    placeholder="github-username"
                    fullWidth
                    size="small"
                    value={gitUser}
                    onChange={(e) => setGitUser(e.target.value)}
                  />
                  <TextField
                    label="Personal Access Token / Password"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    fullWidth
                    size="small"
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                  />
                </Stack>
              </Paper>

              <FormControlLabel
                control={
                  <Switch
                    checked={autoDeployWebhook}
                    onChange={(e) => setAutoDeployWebhook(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Enable Instant Push-to-Deploy (Webhook)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ClearPanel will automatically re-deploy when you push code to this repository
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </Box>
        )}

        {/* STEP 2: Live Deploy Results & Auto CI/CD Hub */}
        {activeStep === 2 && (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              🎉 Project <strong>{projectName || deployedRepo?.name}</strong> successfully deployed to ClearPanel!
            </Alert>

            {detection && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                  <Chip
                    icon={<CodeIcon />}
                    label={detection.frameworkName}
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip label={`Runtime: ${detection.recommendedRuntime}`} size="small" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Detected configuration files:{' '}
                  {detection.detectedFiles.length > 0 ? detection.detectedFiles.join(', ') : 'standard'}
                </Typography>
              </Paper>
            )}

            {/* CI/CD Integration Tabs */}
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Continuous Integration & Deployment (CI/CD) Auto-Set
            </Typography>

            <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
              <Tabs value={cicdTab} onChange={(_, v) => setCicdTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Webhook (Push-to-Deploy)" icon={<GitHubIcon fontSize="small" />} iconPosition="start" />
                <Tab label="GitHub Actions Pipeline" icon={<TerminalIcon fontSize="small" />} iconPosition="start" />
                <Tab label="Initial Deploy Logs" icon={<CodeIcon fontSize="small" />} iconPosition="start" />
              </Tabs>

              {/* Tab 0: Webhook Mode */}
              {cicdTab === 0 && (
                <Box sx={{ p: 2.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Add this Webhook to your GitHub repository under <strong>Settings &gt; Webhooks &gt; Add webhook</strong>.
                    Set Content type to <strong>application/json</strong>.
                  </Typography>

                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        PAYLOAD URL
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          mt: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          bgcolor: 'background.default',
                        }}
                      >
                        <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                          {webhookUrl || `${window.location.origin}/api/git-webhook/github/${deployedRepo?.webhookId}`}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleCopy(
                              webhookUrl || `${window.location.origin}/api/git-webhook/github/${deployedRepo?.webhookId}`,
                            )
                          }
                        >
                          {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                      </Paper>
                    </Box>

                    {webhookSecret && (
                      <Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          WEBHOOK SECRET
                        </Typography>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            mt: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            bgcolor: 'background.default',
                          }}
                        >
                          <Typography variant="body2" fontFamily="monospace">
                            {webhookSecret}
                          </Typography>
                          <IconButton size="small" onClick={() => handleCopy(webhookSecret)}>
                            {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                          </IconButton>
                        </Paper>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Tab 1: GitHub Actions Mode */}
              {cicdTab === 1 && (
                <Box sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Save this file as <code>.github/workflows/deploy.yml</code> in your repository for automated testing & deployment:
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                      onClick={() => handleCopy(generatedWorkflow)}
                    >
                      {copied ? 'Copied' : 'Copy Workflow'}
                    </Button>
                  </Stack>

                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#0d1117',
                      color: '#e6edf3',
                      borderRadius: 1.5,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      maxHeight: 280,
                      overflow: 'auto',
                      whiteSpace: 'pre',
                    }}
                  >
                    {generatedWorkflow}
                  </Box>
                </Box>
              )}

              {/* Tab 2: Deploy Logs */}
              {cicdTab === 2 && (
                <Box sx={{ p: 2.5 }}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#0d1117',
                      color: '#58a6ff',
                      borderRadius: 1.5,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      maxHeight: 280,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {deployLog || 'Initial build completed without output warnings.'}
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2.5 }}>
        {activeStep === 0 ? (
          <>
            <Button onClick={resetModal} color="inherit" disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
              onClick={handleStartDeploy}
              disabled={busy || !repoUrl}
            >
              {busy ? 'Cloning & Deploying...' : 'Deploy Project & Setup CI/CD'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={resetModal}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
