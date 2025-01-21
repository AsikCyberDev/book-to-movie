#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BookToMovieStack } from '../lib/book_to_movie_stack';

const app = new cdk.App();
new BookToMovieStack(app, 'BookToMovieStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
