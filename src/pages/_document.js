import * as React from 'react';
import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class _document extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  };
};