/**
 * Stream Service
 * Handles streaming payment logic and vesting calculations
 */

export interface Stream {
  id: string;
  stream_id: string;
  vault_id: string;
  sender: string;
  recipient: string;
  token_type: 'BCH' | 'CASHTOKENS';
  token_category?: string;
  total_amount: number;
  withdrawn_amount: number;
  stream_type: 'LINEAR' | 'RECURRING' | 'STEP';
  start_time: number;
  end_time?: number;
  interval_seconds?: number;
  cliff_timestamp?: number;
  cancelable: boolean;
  transferable: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
  created_at: number;
  updated_at: number;
}

export interface StreamClaim {
  id: string;
  stream_id: string;
  recipient: string;
  amount: number;
  claimed_at: number;
  tx_hash?: string;
}

export interface StreamWithVested extends Stream {
  vested_amount: number;
  claimable_amount: number;
  progress_percentage: number;
}

export class StreamService {
  /**
   * Compute vested amount for a stream based on current time
   * Uses linear vesting formula: vested = total * (elapsed / duration)
   */
  computeVestedAmount(stream: Stream): number {
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp

    // Stream not started yet
    if (now < stream.start_time) {
      return 0;
    }

    // Before cliff period
    if (stream.cliff_timestamp && now < stream.cliff_timestamp) {
      return 0;
    }

    // Stream not active
    if (stream.status !== 'ACTIVE') {
      return stream.withdrawn_amount;
    }

    // Recurring streams vest per interval (contract pays one interval per spend).
    if (stream.stream_type === 'RECURRING' && stream.interval_seconds) {
      const intervalsPassed = Math.max(0, Math.floor((now - stream.start_time) / stream.interval_seconds));
      const totalIntervals = stream.end_time
        ? Math.max(1, Math.floor((stream.end_time - stream.start_time) / stream.interval_seconds))
        : Math.max(1, intervalsPassed);
      const amountPerInterval = stream.total_amount / totalIntervals;
      return Math.min(intervalsPassed * amountPerInterval, stream.total_amount);
    }

    // No end time = perpetual unlock for non-recurring stream shapes.
    if (!stream.end_time) {
      return stream.total_amount;
    }

    // Stream completed
    if (now >= stream.end_time) {
      return stream.total_amount;
    }

    // Linear vesting calculation
    const elapsed = now - stream.start_time;
    const duration = stream.end_time - stream.start_time;

    if (duration <= 0) {
      return stream.total_amount;
    }

    const vested = (stream.total_amount * elapsed) / duration;
    return Math.min(vested, stream.total_amount);
  }

  /**
   * Get claimable amount (vested - already withdrawn)
   */
  getClaimableAmount(stream: Stream): number {
    const vested = this.computeVestedAmount(stream);
    const claimable = vested - stream.withdrawn_amount;
    return Math.max(0, claimable); // Never negative
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgressPercentage(stream: Stream): number {
    if (stream.total_amount === 0) return 0;

    const vested = this.computeVestedAmount(stream);
    const percentage = (vested / stream.total_amount) * 100;
    return Math.min(100, Math.max(0, percentage));
  }

  /**
   * Enrich stream with computed vested amounts
   */
  enrichStream(stream: Stream): StreamWithVested {
    const vested_amount = this.computeVestedAmount(stream);
    const claimable_amount = this.getClaimableAmount(stream);
    const progress_percentage = this.getProgressPercentage(stream);

    return {
      ...stream,
      vested_amount,
      claimable_amount,
      progress_percentage,
    };
  }

  /**
   * Enrich multiple streams
   */
  enrichStreams(streams: Stream[]): StreamWithVested[] {
    return streams.map(stream => this.enrichStream(stream));
  }

  /**
   * Generate human-readable stream ID
   * Format: #FG-BCH-001, #FG-TOK-042
   */
  generateStreamId(tokenType: 'BCH' | 'CASHTOKENS', sequence: number): string {
    const prefix = tokenType === 'BCH' ? 'BCH' : 'TOK';
    const paddedSequence = sequence.toString().padStart(3, '0');
    return `#FG-${prefix}-${paddedSequence}`;
  }

  /**
   * Check if stream can be claimed
   */
  canClaim(stream: Stream): boolean {
    if (stream.status !== 'ACTIVE') return false;
    const claimable = this.getClaimableAmount(stream);
    return claimable > 0;
  }

  /**
   * Check if stream can be cancelled
   */
  canCancel(stream: Stream, sender: string): boolean {
    if (!sender) return false;
    if (stream.status !== 'ACTIVE') return false;
    if (!stream.cancelable) return false;
    if (stream.sender.toLowerCase() !== sender.toLowerCase()) return false;
    return true;
  }

  /**
   * Calculate total claimable across multiple streams
   */
  getTotalClaimable(streams: Stream[]): number {
    return streams.reduce((total, stream) => {
      return total + this.getClaimableAmount(stream);
    }, 0);
  }

  /**
   * Get stream status with additional context
   */
  getStreamStatus(stream: Stream): {
    status: string;
    label: string;
    color: string;
  } {
    const now = Math.floor(Date.now() / 1000);

    if (stream.status === 'CANCELLED') {
      return { status: 'CANCELLED', label: 'Cancelled', color: 'red' };
    }

    if (stream.status === 'PAUSED') {
      return { status: 'PAUSED', label: 'Paused', color: 'yellow' };
    }

    if (stream.status === 'COMPLETED') {
      return { status: 'COMPLETED', label: 'Completed', color: 'green' };
    }

    // Active stream
    if (now < stream.start_time) {
      return { status: 'PENDING', label: 'Scheduled', color: 'blue' };
    }

    if (stream.cliff_timestamp && now < stream.cliff_timestamp) {
      return { status: 'CLIFF', label: 'Cliff Period', color: 'purple' };
    }

    if (stream.end_time && now >= stream.end_time) {
      return { status: 'ENDED', label: 'Ended', color: 'gray' };
    }

    return { status: 'STREAMING', label: 'Streaming', color: 'green' };
  }
}

// Export singleton instance
export const streamService = new StreamService();
