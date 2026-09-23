import React from 'react';
import ReactPullToRefresh from 'react-pull-to-refresh';

const PullToRefresh = ({ onRefresh, children }) => {
  const handleRefresh = () => {
    return new Promise((resolve) => {
      // Call the onRefresh prop and wait for it to complete
      Promise.resolve(onRefresh()).then(() => {
        resolve();
      });
    });
  };

  return (
    <ReactPullToRefresh
      onRefresh={handleRefresh}
      style={{
        textAlign: 'center',
        width: '100%',
        height: '100%',
      }}
      pullDownThreshold={100}
    >
      {children}
    </ReactPullToRefresh>
  );
};

export default PullToRefresh;