'use client';

import { useRef, useState, useEffect } from 'react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { useLoginActions } from '@/hooks/useLoginActions';
import { Shield, Eye, EyeOff, Copy, Check } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

type SignupStep = 'initial' | 'save-keys';

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [nsec, setNsec] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Signup state
  const [signupStep, setSignupStep] = useState<SignupStep>('initial');
  const [generatedNsec, setGeneratedNsec] = useState<string | null>(null);
  const [generatedNpub, setGeneratedNpub] = useState<string | null>(null);
  const [nsecCopied, setNsecCopied] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showNsec, setShowNsec] = useState(false);

  const loginActions = useLoginActions();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNsec('');
      setSignupStep('initial');
      setGeneratedNsec(null);
      setGeneratedNpub(null);
      setShowSaveConfirmation(false);
      setShowNsec(false);
      setNsecCopied(false);
    }
  }, [isOpen]);

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      await loginActions.extension();
      onLogin();
      onClose();
    } catch (error) {
      console.error('Extension login failed:', error);
      setError('Extension login failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = async () => {
    if (!nsec.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      loginActions.nsec(nsec);
      onLogin();
      onClose();
    } catch (error) {
      console.error('Nsec login failed:', error);
      setError('Nsec login failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewKeypair = () => {
    try {
      const secretKey = generateSecretKey();
      const publicKey = getPublicKey(secretKey);
      const nsecEncoded = nip19.nsecEncode(secretKey);
      const npubEncoded = nip19.npubEncode(publicKey);

      setGeneratedNsec(nsecEncoded);
      setGeneratedNpub(npubEncoded);
      setNsecCopied(false);
      setShowSaveConfirmation(false);
      setShowNsec(false);
      setSignupStep('save-keys');
    } catch (error) {
      console.error('Error generating keypair:', error);
      setError('Failed to generate new keys. Please try again.');
    }
  };

  const copyToClipboard = async (text: string, type: 'npub' | 'nsec') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'nsec') {
          setNsecCopied(true);
        setTimeout(() => setNsecCopied(false), 2000);
        }
    } catch (err) {
        console.error('Failed to copy:', err);
      }
  };

  const completeSignup = async () => {
    if (generatedNsec) {
      try {
        loginActions.nsec(generatedNsec);
        onLogin();
        onClose();
      } catch (error) {
        console.error('Failed to login with generated key:', error);
        setError('Failed to login with the generated key: ' + (error as Error).message);
      }
    }
  };

  const handleSaveLater = async () => {
    localStorage.setItem('nsec_storing_skipped', 'true');
    await completeSignup();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 backdrop-blur-xl border-2 border-white/20 rounded-xl max-w-2xl w-full p-4 relative shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors z-10 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Flex Layout */}
        <div className="flex gap-4">
          
          {/* Left Column - Welcome + Signup */}
          <div className="w-1/2 flex flex-col space-y-2">
            
            {/* Welcome Section - Top Left */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-1">Welcome to Routstr</h2>
                <p className="text-xs text-gray-400">A decentralized LLM routing marketplace</p>
              </div>
            </div>

            {/* Signup Section - Bottom Left */}
            <div className="p-3">
              <div className="text-center pb-2 border-b border-white/10">
                <h3 className="text-base font-semibold text-white mb-1">Create Account</h3>
                <p className="text-xs text-gray-400">New to Nostr?</p>
              </div>

              <div className="mt-3">
                {signupStep === 'initial' && (
                  <div className="space-y-3">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-2 h-2 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-yellow-200 font-medium mb-1">Important</p>
                          <p className="text-xs text-yellow-200/80">Save your private key securely - we cannot recover it if lost.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={generateNewKeypair}
                      className="w-full py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Generate New Identity
                    </button>
                  </div>
                )}

                {signupStep === 'save-keys' && generatedNsec && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-white font-medium mb-2 text-center">Save your private key!</p>
                      
                      {/* Private Key Display */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-red-400">Private Key</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowNsec(!showNsec)}
                              className="text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                            >
                              {showNsec ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(generatedNsec, 'nsec')}
                              className="text-xs text-white/70 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {nsecCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {nsecCopied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <div className="px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-gray-300 break-all font-mono">
                          {showNsec ? generatedNsec : generatedNsec.substring(0, 8) + '•'.repeat(20) + generatedNsec.substring(generatedNsec.length - 8)}
                        </div>
                      </div>

                      {/* Confirmation Checkbox */}
                      <div className="flex items-start gap-2 p-2 bg-white/5 border border-white/10 rounded-lg">
                        <input
                          id="saved-confirmation"
                          type="checkbox"
                          checked={showSaveConfirmation}
                          onChange={(e) => setShowSaveConfirmation(e.target.checked)}
                          className="mt-0.5 h-3 w-3 bg-transparent border border-white/30 rounded focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <label htmlFor="saved-confirmation" className="text-xs text-gray-300 cursor-pointer">
                          I have saved my private key securely
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={completeSignup}
                        disabled={!showSaveConfirmation}
                        className="w-full py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        Complete Setup
                      </button>

                      <button
                        onClick={handleSaveLater}
                        className="w-full py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        I'll Save It Later
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Sign In */}
          <div className="w-1/2 p-3">
            <div className="text-center pb-2 border-b border-white/10">
              <h3 className="text-base font-semibold text-white mb-1">Sign In</h3>
              <p className="text-xs text-gray-400">Already have an account?</p>
            </div>

            <div className="mt-3 space-y-3">
              {/* Extension Login */}
              <button
                onClick={handleExtensionLogin}
                disabled={isLoading}
                className="w-full py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Browser Extension
                  </>
                )}
              </button>

              {/* OR Separator */}
              <div className="relative flex items-center justify-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-3 text-white/50 text-xs font-medium">OR</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              {/* Private Key Login */}
              <div>
                <label htmlFor="nsec" className="block text-sm font-medium text-white mb-2">
                  Private Key (nsec)
                </label>
                <input
                  id="nsec"
                  type="password"
                  value={nsec}
                  onChange={(e) => setNsec(e.target.value)}
                  placeholder="nsec1..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                />
              </div>

              <button
                onClick={handleKeyLogin}
                disabled={isLoading || !nsec.trim()}
                className="w-full py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
              {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}