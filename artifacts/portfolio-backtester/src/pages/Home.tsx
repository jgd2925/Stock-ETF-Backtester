import React from 'react';
import { Grid } from '@mui/material';

const Home = () => {
    return (
        <Grid container className='py-4'>
            <Grid item xs={12} className='mb-4'>
                <h1>Welcome to the Portfolio Backtester</h1>
            </Grid>
            <Grid item className='grid grid-cols-1 lg:grid-cols-[550px_1fr]' xs={12} lg={12}>
                {/* Other components */}
            </Grid>
        </Grid>
    );
};

export default Home;