/**
 * Wallet API Routes
 * Provides wallet balance and address information
 */

import { Router } from 'express';

const router = Router();

/**
 * Get wallet balance by address
 * GET /api/wallet/balance/:address
 */
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || (!address.startsWith('bitcoincash:') && !address.startsWith('bchtest:'))) {
      return res.status(400).json({
        error: 'Invalid address format. Must be cashaddr format (bitcoincash: or bchtest:)',
      });
    }

    // Determine network and API endpoint
    const isTestnet = address.startsWith('bchtest:');
    const network = isTestnet ? 'chipnet' : 'mainnet';
    const apiUrl = isTestnet
      ? 'https://gql.chaingraph.pat.mn/v1/graphql'
      : 'https://gql.chaingraph.cash/v1/graphql';

    // Extract address without prefix for query
    const addressWithoutPrefix = address.split(':')[1];

    // Query Chaingraph for UTXOs
    const query = `
      query GetBalance($address: String!) {
        output(where: {
          locking_bytecode_pattern: {_like: $address}
          _not: {spent_by: {}}
        }) {
          value_satoshis
        }
      }
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { address: `%${addressWithoutPrefix}%` },
      }),
    });

    const data = await response.json() as any;
    const outputs = data?.data?.output || [];
    const balanceSat = outputs.reduce((sum: number, output: any) => sum + (output.value_satoshis || 0), 0);
    const balanceBch = balanceSat / 100000000;

    res.json({
      address,
      sat: balanceSat,
      satoshis: balanceSat,
      bch: balanceBch,
      network,
    });
  } catch (error: any) {
    console.error('Balance query error:', error);
    res.status(500).json({
      error: 'Failed to query balance',
      message: error.message,
    });
  }
});

/**
 * Get UTXOs for an address
 * GET /api/wallet/utxos/:address
 */
router.get('/utxos/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || (!address.startsWith('bitcoincash:') && !address.startsWith('bchtest:'))) {
      return res.status(400).json({
        error: 'Invalid address format',
      });
    }

    // Use ElectrumNetworkProvider to get UTXOs
    const { ElectrumNetworkProvider } = await import('cashscript');
    const network = address.startsWith('bitcoincash:') ? 'mainnet' : 'chipnet';
    const provider = new ElectrumNetworkProvider(network as any);
    const utxos = await provider.getUtxos(address);

    res.json({
      address,
      utxos,
      count: utxos.length,
    });
  } catch (error: any) {
    console.error('UTXO query error:', error);
    res.status(500).json({
      error: 'Failed to query UTXOs',
      message: error.message,
    });
  }
});

export default router;
