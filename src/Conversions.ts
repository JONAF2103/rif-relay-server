import type ExchangeToken from './definitions/token.type';
import { RelayPricer } from '@rsksmart/rif-relay-client';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { BigNumber, constants } from 'ethers';
import type { BigNumberish } from 'ethers';

export const TARGET_CURRENCY = 'RBTC';

export const RBTC_CHAIN_DECIMALS = 18; // FIXME: should this be configurable?
export const MAX_ETH_GAS_BLOCK_SIZE = 30_000_000;

const relayPricer = new RelayPricer();

type BigNumberishJs = BigNumberish | BigNumberJs;

/**
 * Multiplies base to power of precision
 * @param precision order of magnitude of the precision i.e. number of zeroes. Defaults to system's native currency precision
 * @param base defaults to base 10
 * @returns BigNumber
 */
export const getPrecision = (
  precision: BigNumberishJs = RBTC_CHAIN_DECIMALS,
  base = 10
): BigNumber => parseToBigNumber(BigNumberJs(base).pow(precision.toString()));

/**
 * value and precision for the value to be converted to
 */
export type ToPrecisionParams = {
  value: BigNumberish;
  precision?: number;
};

/**
 * Converts a value to given precision
 * @note large negative powers fail to compute, so direct division is used for negative precision
 * @param ToPrecisionParams
 * @returns BigNumber representation of the calculated precision
 */
export const toPrecision = ({
  value,
  precision = 0,
}: ToPrecisionParams): BigNumber => {
  const bigValue = BigNumberJs(value.toString());
  const bigPrecision = BigNumberJs(precision);
  const precisionMultiplier = BigNumberJs(
    getPrecision(bigPrecision.absoluteValue()).toString()
  );
  const operation = bigPrecision.isNegative() ? 'dividedBy' : 'multipliedBy';

  return parseToBigNumber(bigValue[operation](precisionMultiplier));
};

/**
 * Retreives exchange rate for given token
 * @param token Token object containing token name
 * @returns BigNumber representation of the exchange rate
 */
export const getXRateFor = async ({
  symbol,
}: ExchangeToken): Promise<string> => {
  const exchangeRate = await relayPricer.getExchangeRate(
    symbol,
    TARGET_CURRENCY
  );

  return exchangeRate.toString();
};

/**
 * Converts token amount to native "wei" representation
 * @param token object containing the amount, decimals and exchange rate of the token
 * @returns 'WEI' representation of the token converted to native currency and decimal system
 */
export const toNativeWeiFrom = ({
  amount,
  decimals = 18,
  xRate,
}: ExchangeToken): BigNumber => {
  const bigAmount = BigNumberJs(amount ?? '0');
  const bigxRate = BigNumberJs(xRate ?? '0');

  if (bigAmount.isZero() || bigxRate.isZero()) {
    return constants.Zero;
  }

  const amountAsFraction = toPrecision({
    value: bigAmount.toString(),
    precision: -decimals,
  });

  const bigAmountFraction = BigNumberJs(amountAsFraction.toString());

  return toPrecision({
    value: bigAmountFraction.multipliedBy(bigxRate).toFixed(0),
    precision: RBTC_CHAIN_DECIMALS,
  });
};

/**
 * Converts gas estimation to token amount
 * @param estimation estimation to be converted
 * @param xRate exchange rate of the token
 * @param gasPrice gas price use to convert to WEI
 * @returns 'WEI' representation of the gas converted to token
 */
export const convertGasToToken = (
  estimation: BigNumberish,
  { decimals = 18, xRate }: ExchangeToken,
  gasPrice: BigNumberish
): BigNumber => {
  const bigEstimation = BigNumberJs(estimation.toString());
  const bigPrice = BigNumberJs(gasPrice.toString());
  const bigRate = BigNumberJs(xRate ?? '0');

  if (
    isInvalidNumber(bigEstimation) ||
    isInvalidNumber(bigRate) ||
    isInvalidNumber(bigPrice) ||
    bigRate.isZero()
  ) {
    return constants.Zero;
  }

  const precision = RBTC_CHAIN_DECIMALS - decimals;
  const total = toPrecision({
    value: bigEstimation.multipliedBy(bigPrice).toString(),
    precision,
  });

  const bigTotal = BigNumberJs(total.toString());

  return parseToBigNumber(bigTotal.dividedBy(bigRate).toFixed(0));
};

/**
 * Converts gas estimation to native amount
 * @param estimation estimation to be converted
 * @param gasPrice gas price use to convert to WEI
 * @returns 'WEI' representation of the gas converted to native
 */
export const convertGasToNative = (
  estimation: BigNumberish,
  gasPrice: BigNumberish
): BigNumber => {
  const bigEstimation = BigNumberJs(estimation.toString());
  const bigPrice = BigNumberJs(gasPrice.toString());
  if (isInvalidNumber(bigEstimation) || isInvalidNumber(bigPrice)) {
    return constants.Zero;
  }

  return parseToBigNumber(bigEstimation.multipliedBy(bigPrice));
};

/**
 * Verify that a number is not valid
 * @param value BigNumber value
 * @returns `true` if value is  either negative, infinite or a NaN; `false` otherwise
 */
const isInvalidNumber = (value: BigNumberJs): boolean => {
  if (value.isNegative() || value.isNaN() || !value.isFinite()) {
    return true;
  }

  return false;
};

export const parseToBigNumber = (value: BigNumberishJs): BigNumber =>
  BigNumber.from(value.toString());
