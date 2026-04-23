/**
 * bePaid / beGateway — виджет https://js.bepaid.by/widget/be_gateway.js
 * @see https://docs.bepaid.by/en/integration/widget/
 */

export type BePaidWidgetCloseStatus =
  | "successful"
  | "failed"
  | "pending"
  | "redirected"
  | "error"
  | null;

export type BeGatewayCheckoutConfig = {
  iframe?: boolean;
  test?: boolean;
  transaction_type: string;
  public_key?: string;
  token?: string;
  order?: {
    amount: number;
    currency: string;
    description: string;
    tracking_id: string;
  };
};

export type BeGatewayParams = {
  checkout_url: string;
  fromWebview?: boolean;
  checkout: BeGatewayCheckoutConfig;
  closeWidget?: (status: BePaidWidgetCloseStatus) => void;
};

export type BeGatewayConstructor = new (
  params: BeGatewayParams
) => {
  createWidget: () => void;
};

declare global {
  interface Window {
    BeGateway: BeGatewayConstructor;
  }
}

export {};
