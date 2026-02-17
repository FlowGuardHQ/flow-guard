import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import Papa from 'papaparse';

interface RecipientRow {
  address: string;
  amount: number;
  duration: number; // in seconds
  type: 'LINEAR' | 'RECURRING' | 'STEP';
  cancelable: boolean;
  valid: boolean;
  errors: string[];
}

/**
 * BatchCreateStreamsPage
 * Mass stream creation via CSV upload
 */
export default function BatchCreateStreamsPage() {
  const { id: vaultId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'creating' | 'complete'>('upload');
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  // CSV Template
  const csvTemplate = `address,amount,duration_days,type,cancelable
bitcoincash:qr2x3uy3...xyz,1.5,30,LINEAR,true
bitcoincash:qp5v8rk2...abc,2.0,60,LINEAR,true
bitcoincash:qq3m9xt7...def,0.5,90,LINEAR,false`;

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowguard-batch-streams-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    parseCSV(file);
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: RecipientRow[] = results.data.map((row: any, idx) => {
          const errors: string[] = [];
          let valid = true;

          // Validate address
          if (!row.address || !row.address.startsWith('bitcoincash:')) {
            errors.push('Invalid BCH address format');
            valid = false;
          }

          // Validate amount
          const amount = parseFloat(row.amount);
          if (isNaN(amount) || amount <= 0) {
            errors.push('Invalid amount');
            valid = false;
          }

          // Validate duration
          const durationDays = parseInt(row.duration_days);
          if (isNaN(durationDays) || durationDays <= 0) {
            errors.push('Invalid duration');
            valid = false;
          }

          // Validate type
          const type = (row.type || 'LINEAR').toUpperCase();
          if (!['LINEAR', 'RECURRING', 'STEP'].includes(type)) {
            errors.push('Invalid stream type (must be LINEAR, RECURRING, or STEP)');
            valid = false;
          }

          return {
            address: row.address,
            amount,
            duration: durationDays * 86400, // Convert days to seconds
            type: type as any,
            cancelable: row.cancelable !== 'false',
            valid,
            errors,
          };
        });

        setRecipients(parsed);
        setStep('preview');
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`]);
      },
    });
  };

  const handleCreate = async () => {
    setStep('creating');
    setCreatedCount(0);

    try {
      const validRecipients = recipients.filter(r => r.valid);

      // Call batch create API
      const response = await fetch(`/api/treasuries/${vaultId}/batch-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: validRecipients }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Batch creation failed');
      }

      // Simulate progress
      for (let i = 1; i <= validRecipients.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setCreatedCount(i);
      }

      setStep('complete');
    } catch (error: any) {
      setErrors([error.message]);
      setStep('preview');
    }
  };

  const validCount = recipients.filter(r => r.valid).length;
  const invalidCount = recipients.length - validCount;
  const totalAmount = recipients
    .filter(r => r.valid)
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/vaults/${vaultId}`}
          className="inline-flex items-center gap-2 text-textSecondary hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Treasury
        </Link>

        <h1 className="text-4xl font-bold text-textPrimary mb-2">
          Batch Create Streams
        </h1>
        <p className="text-textSecondary">
          Upload a CSV file to create multiple payment streams at once
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-center mb-8">
        {['Upload', 'Preview', 'Creating', 'Complete'].map((label, idx) => {
          const stepLabels = ['upload', 'preview', 'creating', 'complete'];
          const currentIdx = stepLabels.indexOf(step);
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;

          return (
            <div key={label} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  isCompleted
                    ? 'bg-primary border-primary text-white'
                    : isActive
                    ? 'border-primary text-primary'
                    : 'border-border text-textMuted'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{idx + 1}</span>
                )}
              </div>
              {idx < 3 && (
                <div
                  className={`w-24 h-0.5 mx-2 ${
                    isCompleted ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Content based on step */}
      {step === 'upload' && (
        <Card className="p-12">
          <div className="text-center max-w-md mx-auto">
            <Upload className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-textPrimary mb-4">
              Upload Recipient List
            </h2>
            <p className="text-textSecondary mb-8">
              Upload a CSV file with recipient addresses, amounts, and durations
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="space-y-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-5 h-5 mr-2" />
                Choose CSV File
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={downloadTemplate}
                className="w-full"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Template
              </Button>
            </div>

            {/* Template Preview */}
            <div className="mt-8 p-4 bg-surfaceAlt rounded-lg text-left">
              <p className="text-xs text-textMuted mb-2 font-semibold">CSV Format:</p>
              <pre className="text-xs font-mono text-textPrimary overflow-x-auto">
                {csvTemplate}
              </pre>
            </div>
          </div>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <p className="text-sm text-textMuted mb-1">Valid Recipients</p>
              <p className="text-3xl font-bold text-primary">{validCount}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-textMuted mb-1">Invalid Recipients</p>
              <p className="text-3xl font-bold text-red-600">{invalidCount}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-textMuted mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-textPrimary">
                {totalAmount.toFixed(4)} BCH
              </p>
            </Card>
          </div>

          {/* Recipients Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-textPrimary">
                Recipients ({recipients.length})
              </h3>
              {csvFile && (
                <span className="text-sm text-textMuted">{csvFile.name}</span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-textMuted">#</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-textMuted">Address</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-textMuted">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-textMuted">Duration</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-textMuted">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-textMuted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-border ${
                        !recipient.valid ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-textPrimary">{idx + 1}</td>
                      <td className="py-3 px-4 text-sm font-mono text-textPrimary">
                        {recipient.address.slice(0, 20)}...
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-textPrimary">
                        {recipient.amount.toFixed(4)} BCH
                      </td>
                      <td className="py-3 px-4 text-sm text-textPrimary">
                        {Math.floor(recipient.duration / 86400)}d
                      </td>
                      <td className="py-3 px-4 text-sm text-textPrimary">
                        {recipient.type}
                      </td>
                      <td className="py-3 px-4">
                        {recipient.valid ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="text-xs text-red-600">
                              {recipient.errors[0]}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setStep('upload');
                setCsvFile(null);
                setRecipients([]);
              }}
            >
              Upload Different File
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={validCount === 0}
              className="flex-1"
            >
              Create {validCount} Stream{validCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {step === 'creating' && (
        <Card className="p-12">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-6">
              <Loader className="w-16 h-16 text-primary mx-auto animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-textPrimary mb-4">
              Creating Streams...
            </h2>
            <p className="text-textSecondary mb-8">
              Creating {createdCount} of {validCount} streams
            </p>

            {/* Progress Bar */}
            <div className="w-full h-4 bg-surfaceAlt rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(createdCount / validCount) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-textMuted mt-2">
              {Math.floor((createdCount / validCount) * 100)}% complete
            </p>
          </div>
        </Card>
      )}

      {step === 'complete' && (
        <Card className="p-12">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-textPrimary mb-4">
              Streams Created Successfully!
            </h2>
            <p className="text-textSecondary mb-8">
              Created {validCount} payment streams totaling {totalAmount.toFixed(4)} BCH
            </p>

            <div className="space-y-4">
              <Button
                variant="primary"
                onClick={() => navigate(`/vaults/${vaultId}`)}
                className="w-full"
              >
                View Treasury
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload');
                  setCsvFile(null);
                  setRecipients([]);
                  setCreatedCount(0);
                }}
                className="w-full"
              >
                Create More Streams
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="p-4 bg-red-50 border-red-200 mt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800 mb-2">Errors</p>
              <ul className="space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-700">
                    • {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
