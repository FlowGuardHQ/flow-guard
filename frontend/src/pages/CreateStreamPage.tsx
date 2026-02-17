import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { useWallet } from '../hooks/useWallet';
import { useNetwork } from '../hooks/useNetwork';
import { fundStreamContract } from '../utils/blockchain';
import { validateTokenCategory } from '../utils/tokenValidation';
import { Calendar, Coins, Clock, Lock, AlertCircle } from 'lucide-react';

/**
 * CreateStreamPage - Single stream creation form
 *
 * Features:
 * - Recipient address input
 * - Token type selector (BCH/CashTokens)
 * - Amount & duration inputs
 * - Stream type selector (LINEAR/RECURRING/STEP)
 * - Cliff period (optional)
 * - Cancelable toggle
 * - Links to treasury context
 */

type StreamType = 'LINEAR' | 'RECURRING' | 'STEP';
type TokenType = 'BCH' | 'FUNGIBLE_TOKEN';

interface FormData {
  recipient: string;
  tokenType: TokenType;
  tokenCategory?: string; // For CashTokens
  amount: string;
  duration: string; // in days
  streamType: StreamType;
  cliffDays: string;
  cancelable: boolean;
  description: string;
}

export default function CreateStreamPage() {
  const navigate = useNavigate();
  const { id: vaultId } = useParams(); // If coming from /vaults/:id/create-stream
  const wallet = useWallet();
  const network = useNetwork();

  const [formData, setFormData] = useState<FormData>({
    recipient: '',
    tokenType: 'BCH',
    amount: '',
    duration: '30',
    streamType: 'LINEAR',
    cliffDays: '0',
    cancelable: true,
    description: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isCreating, setIsCreating] = useState(false);

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    // Recipient address
    if (!formData.recipient) {
      newErrors.recipient = 'Recipient address is required';
    } else if (!formData.recipient.startsWith('bitcoincash:')) {
      newErrors.recipient = 'Must be a valid BCH address (bitcoincash:...)';
    }

    // Token category for CashTokens
    if (formData.tokenType === 'FUNGIBLE_TOKEN') {
      if (!formData.tokenCategory) {
        newErrors.tokenCategory = 'Token category ID is required for CashTokens';
      } else if (formData.tokenCategory.length !== 64) {
        newErrors.tokenCategory = 'Token category must be 64 characters (32-byte hex)';
      } else if (!/^[0-9a-fA-F]{64}$/.test(formData.tokenCategory)) {
        newErrors.tokenCategory = 'Token category must be valid hex';
      }
    }

    // Amount
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    // Duration
    if (!formData.duration || parseInt(formData.duration) <= 0) {
      newErrors.duration = 'Duration must be at least 1 day';
    }

    // Cliff period
    if (formData.cliffDays && parseInt(formData.cliffDays) >= parseInt(formData.duration)) {
      newErrors.cliffDays = 'Cliff period must be shorter than total duration';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsCreating(true);

    // Validate token category on blockchain if CashTokens
    if (formData.tokenType === 'FUNGIBLE_TOKEN' && formData.tokenCategory) {
      try {
        const isValid = await validateTokenCategory(formData.tokenCategory, network);
        if (!isValid) {
          setErrors({
            tokenCategory: 'Token category not found on blockchain. Please verify the token exists.',
          });
          setIsCreating(false);
          return;
        }
      } catch (validationError: any) {
        console.error('Token validation failed:', validationError);
        setErrors({
          tokenCategory: 'Failed to validate token category. Please try again.',
        });
        setIsCreating(false);
        return;
      }
    }

    try {
      // Calculate timestamps
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = parseInt(formData.duration) * 24 * 60 * 60;
      const cliffSeconds = parseInt(formData.cliffDays) * 24 * 60 * 60;

      const streamPayload = {
        sender: wallet.address,
        recipient: formData.recipient,
        tokenType: formData.tokenType,
        tokenCategory: formData.tokenCategory,
        totalAmount: parseFloat(formData.amount),
        streamType: formData.streamType,
        startTime: now,
        endTime: now + durationSeconds,
        cliffTimestamp: cliffSeconds > 0 ? now + cliffSeconds : undefined,
        cancelable: formData.cancelable,
        description: formData.description,
        vaultId: vaultId, // If creating from treasury context
      };

      // API call to create stream
      const response = await fetch('/api/streams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create stream');
      }

      const result = await response.json();
      const streamId = result.stream?.id;

      // Fund the stream contract
      try {
        const txId = await fundStreamContract(wallet, streamId);
        console.log('Stream funded successfully. TxID:', txId);

        // Success - navigate to stream detail or back to treasury
        if (vaultId) {
          navigate(`/vaults/${vaultId}?tab=streams`);
        } else {
          navigate(`/streams/${streamId}`);
        }
      } catch (fundingError: any) {
        console.error('Failed to fund stream:', fundingError);
        // Stream created but funding failed - navigate to stream detail with error
        setErrors({
          recipient: `Stream created but funding failed: ${fundingError.message}. You can fund it later from the stream detail page.`,
        });
        // Still navigate after showing error briefly
        setTimeout(() => {
          if (vaultId) {
            navigate(`/vaults/${vaultId}?tab=streams`);
          } else {
            navigate(`/streams/${streamId}`);
          }
        }, 3000);
      }
    } catch (error: any) {
      console.error('Failed to create stream:', error);
      setErrors({ recipient: error.message || 'Failed to create stream. Please try again.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    if (vaultId) {
      navigate(`/vaults/${vaultId}`);
    } else {
      navigate('/streams');
    }
  };

  // Calculate estimated dates
  const calculateEndDate = () => {
    if (!formData.duration) return null;
    const days = parseInt(formData.duration);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    return endDate.toLocaleDateString();
  };

  const calculateCliffDate = () => {
    if (!formData.cliffDays || parseInt(formData.cliffDays) === 0) return null;
    const days = parseInt(formData.cliffDays);
    const cliffDate = new Date();
    cliffDate.setDate(cliffDate.getDate() + days);
    return cliffDate.toLocaleDateString();
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-display font-bold mb-4 text-textPrimary">
            Create Stream
          </h1>
          <p className="text-textMuted font-mono">
            {vaultId
              ? 'Create a vesting stream from your treasury'
              : 'Set up a time-locked payment stream on Bitcoin Cash'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Type Selector */}
          <Card padding="lg">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Coins className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-display font-bold text-textPrimary mb-1">
                  Token Type
                </h3>
                <p className="text-sm text-textMuted font-mono mb-4">
                  Choose the asset to stream
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleChange('tokenType', 'BCH')}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      formData.tokenType === 'BCH'
                        ? 'border-accent bg-accent/5 shadow-lg'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <div className="font-display font-bold text-lg text-textPrimary mb-1">
                      Bitcoin Cash
                    </div>
                    <div className="text-sm text-textMuted font-mono">
                      Stream BCH natively
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange('tokenType', 'FUNGIBLE_TOKEN')}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      formData.tokenType === 'FUNGIBLE_TOKEN'
                        ? 'border-accent bg-accent/5 shadow-lg'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <div className="font-display font-bold text-lg text-textPrimary mb-1">
                      CashTokens
                    </div>
                    <div className="text-sm text-textMuted font-mono">
                      Stream fungible tokens
                    </div>
                  </button>
                </div>

                {/* Token Category Input (for CashTokens) */}
                {formData.tokenType === 'FUNGIBLE_TOKEN' && (
                  <div className="mt-4">
                    <Input
                      label="Token Category ID"
                      placeholder="e.g., a1b2c3d4e5f6..."
                      value={formData.tokenCategory || ''}
                      onChange={(e) => handleChange('tokenCategory', e.target.value)}
                      error={errors.tokenCategory}
                      helpText="The unique identifier for the CashToken you want to stream"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Recipient */}
          <Card padding="lg">
            <Input
              label="Recipient Address"
              placeholder="bitcoincash:qr2x3uy3..."
              value={formData.recipient}
              onChange={(e) => handleChange('recipient', e.target.value)}
              error={errors.recipient}
              helpText="The BCH address that will receive the streamed funds"
              required
            />
          </Card>

          {/* Amount & Duration */}
          <Card padding="lg">
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label={`Total Amount (${formData.tokenType === 'BCH' ? 'BCH' : 'Tokens'})`}
                type="number"
                step="0.00000001"
                placeholder="10.0"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                error={errors.amount}
                required
              />

              <Input
                label="Duration (days)"
                type="number"
                placeholder="30"
                value={formData.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                error={errors.duration}
                helpText={calculateEndDate() ? `Ends on ${calculateEndDate()}` : ''}
                required
              />
            </div>
          </Card>

          {/* Stream Type */}
          <Card padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-display font-bold text-textPrimary mb-1">
                  Vesting Schedule
                </h3>
                <p className="text-sm text-textMuted font-mono mb-4">
                  Choose how funds are released over time
                </p>

                <Select
                  value={formData.streamType}
                  onChange={(e) => handleChange('streamType', e.target.value as StreamType)}
                  options={[
                    { value: 'LINEAR', label: 'Linear Vesting (Gradual unlock)' },
                    { value: 'RECURRING', label: 'Recurring Payment (Fixed intervals)' },
                    { value: 'STEP', label: 'Step Vesting (Milestone-based)' },
                  ]}
                />

                {/* Stream Type Descriptions */}
                <div className="mt-4 p-4 bg-brand-100 rounded-lg border border-border">
                  <div className="text-sm font-mono text-textMuted">
                    {formData.streamType === 'LINEAR' && (
                      <>
                        <span className="font-bold text-textPrimary">Linear Vesting:</span> Funds unlock continuously every second.
                        Perfect for employee vesting, token unlocks, or investor releases.
                      </>
                    )}
                    {formData.streamType === 'RECURRING' && (
                      <>
                        <span className="font-bold text-textPrimary">Recurring Payment:</span> Fixed amount released at regular intervals.
                        Ideal for salaries, subscriptions, or allowances.
                      </>
                    )}
                    {formData.streamType === 'STEP' && (
                      <>
                        <span className="font-bold text-textPrimary">Step Vesting:</span> Funds unlock in chunks at specific milestones.
                        Great for performance-based compensation or project payments.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Cliff Period */}
          <Card padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-display font-bold text-textPrimary mb-1">
                  Cliff Period (Optional)
                </h3>
                <p className="text-sm text-textMuted font-mono mb-4">
                  Minimum time before any funds can be claimed
                </p>

                <Input
                  type="number"
                  placeholder="0"
                  value={formData.cliffDays}
                  onChange={(e) => handleChange('cliffDays', e.target.value)}
                  error={errors.cliffDays}
                  helpText={calculateCliffDate() ? `First claim available: ${calculateCliffDate()}` : 'No cliff - recipient can claim immediately'}
                />
              </div>
            </div>
          </Card>

          {/* Cancelable Toggle */}
          <Card padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-error" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-display font-bold text-textPrimary">
                    Cancelable Stream
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleChange('cancelable', !formData.cancelable)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.cancelable ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.cancelable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-textMuted font-mono">
                  {formData.cancelable
                    ? 'You can cancel this stream and reclaim unvested funds'
                    : 'Stream cannot be cancelled once created (permanent commitment)'
                  }
                </p>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card padding="lg">
            <Textarea
              label="Description (Optional)"
              placeholder="e.g., 'Q1 2024 Contractor Payment' or 'Series A Investor Vesting'"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              helpText="Add context about this stream for your records"
            />
          </Card>

          {/* Summary Box */}
          <Card padding="lg" className="bg-accent/5 border-accent/20">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-display font-bold text-textPrimary mb-2">
                  Stream Summary
                </h4>
                <div className="space-y-1 text-sm font-mono text-textMuted">
                  <p>
                    <span className="text-textPrimary font-bold">{formData.amount || '0'} {formData.tokenType === 'BCH' ? 'BCH' : 'Tokens'}</span> will be streamed to{' '}
                    <span className="text-textPrimary font-bold">{formData.recipient || '[recipient]'}</span>
                  </p>
                  <p>
                    Over <span className="text-textPrimary font-bold">{formData.duration || '0'} days</span> using{' '}
                    <span className="text-textPrimary font-bold">{formData.streamType}</span> vesting
                  </p>
                  {parseInt(formData.cliffDays) > 0 && (
                    <p>
                      With a <span className="text-textPrimary font-bold">{formData.cliffDays} day cliff</span> before first claim
                    </p>
                  )}
                  <p className="pt-2 border-t border-border/40">
                    {formData.cancelable ? (
                      <span className="text-accent">✓ You can cancel and reclaim unvested funds</span>
                    ) : (
                      <span className="text-error">✗ Permanent - cannot be cancelled</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              loading={isCreating}
              className="flex-1"
            >
              {isCreating ? 'Creating Stream...' : 'Create Stream'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
