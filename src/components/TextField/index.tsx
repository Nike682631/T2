import React from 'react';
import styled from 'styled-components';
import { InputLabel, Input, FormControl, FormHelperText } from '@material-ui/core';
import NumberFormat from 'react-number-format';

const Container = styled(FormControl)`
    width: 100%;
    pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
`;

const InputWrapper = styled(Input)<{ right: number | undefined }>`
    &&& {
        padding-right: ${({ right }) => right}px;
        font-weight: 300;
        color: ${({ theme: { colors } }) => colors.primary};
    }
`;

const LabelWrapper = styled(InputLabel)`
    &&& {
        &.Mui-focused {
            color: ${({ theme: { colors } }) => colors.gray3};
        }
        color: rgba(0, 0, 0, 0.38);
        font-size: 16px;
        font-weight: 400;
    }
`;

const ErrorText = styled(FormHelperText)`
  &&& {
    font-size: 12px;
    margin: 5px 0 0 0;
    line-height: 18px;
    height: 18px;
  }
}`;

interface Props1 {
    inputRef: () => void;
    onChange: (val: any) => void;
}

const NumberFormatCustom: React.ComponentType<any> = (props: Props1) => {
    const { inputRef, onChange, ...other } = props;

    return (
        <NumberFormat
            {...other}
            type="text"
            getInputRef={inputRef}
            onValueChange={(values) => {
                onChange({
                    target: {
                        value: values.value,
                    },
                });
            }}
            thousandSeparator={true}
        />
    );
};

interface Props {
    label: string;
    type?: string;
    errorText?: string | React.ReactNode;
    disabled?: boolean;
    right?: number;
    value?: string;
    defaultValue?: string;
    onChange?: (val: string) => void;
    endAdornment?: React.ReactElement;
    readOnly?: boolean;
    dataSpectron?: string;
}

function TextField(props: Props) {
    const { dataSpectron, label, type, onChange, errorText, disabled, right, endAdornment, readOnly, ...other } = props;
    return (
        <Container disabled={disabled}>
            <LabelWrapper htmlFor={dataSpectron || 'custom-input'}>{label}</LabelWrapper>
            <InputWrapper
                data-spectron={dataSpectron || 'custom-input'}
                key={label}
                type={type}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    if (onChange) {
                        onChange(event.target.value);
                    }
                }}
                error={!!errorText}
                disabled={disabled}
                right={right}
                endAdornment={endAdornment}
                readOnly={readOnly}
                inputComponent={type === 'number' ? NumberFormatCustom : 'input'}
                {...other}
            />

            <ErrorText>{errorText}</ErrorText>
        </Container>
    );
}
TextField.defaultProps = {
    type: 'text',
    errorText: '',
    disabled: false,
    right: 0,
};

export default TextField;
