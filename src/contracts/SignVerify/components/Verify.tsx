import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  width: 100%;
  padding: 0 20px 20px 20px;
`;

const MainContainer = styled.div`
  width: 100%;
  margin-top: 30px;
`;

const CodeTxt = styled.div`
  font-size: 16px;
  color: ${({ theme: { colors } }) => colors.primary};
  word-wrap: break-word;
  white-space: pre;
`;

const Verify = () => {
  return (
    <Container>
      <MainContainer/>
    </Container>
  );
};

export default Verify;
