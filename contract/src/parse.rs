use crate::*;

/// helpers for hex parsing (WARNING will fail silently if not hex char)
const HEX_CHARS: &[u8; 16] = b"0123456789abcdef";
const fn val(c: u8) -> u8 {
    match c {
        b'A'..=b'F' => c - b'A' + 10,
        b'a'..=b'f' => c - b'a' + 10,
        b'0'..=b'9' => c - b'0',
        _ => 0
    }
}

const fn byte2hex(byte: u8) -> (u8, u8) {
    let high = HEX_CHARS[((byte & 0xf0) >> 4) as usize];
    let low = HEX_CHARS[(byte & 0x0f) as usize];
    (high, low)
}

pub(crate) fn bytes2hex(bytes: &[u8]) -> Vec<u8> {
    let mut ret = vec![];
	for byte in bytes {
		if *byte == 0 {
			continue;
		}
		let (byte1, byte2) = byte2hex(*byte);
		ret.push(byte1);
		ret.push(byte2);
	}
    ret
}

pub(crate) fn hex2bytes(hex: &[u8], len: usize) -> Vec<u8> {
    let mut ret = vec![];
    for i in (0..len).step_by(2) {
        ret.push(val(hex[i]) << 4 | val(hex[i+1]))
    }
    ret
}

/// helper to get next value from string key in stringified json
pub(crate) fn get_string<'a>(string: &'a str, key: &str) -> &'a str {
	// had to split twice because .get(value.len() - 1) wasn't working with multiple keys in payload
    let (_, value) = string.split_once(key).unwrap_or_else(|| sys::panic());
    let (value, _) = value.split_once(PARAM_STOP).unwrap_or_else(|| sys::panic());
    &value[3..]
}

/// helper to get and parse the next u128 value from a string key in stringified json
pub(crate) fn get_u128(str: &str, key: &str) -> u128 {
    let amount = get_string(str, key);
    // TODO: This should be minimal, but can explore removing ToStr usage for code size
    amount.parse().ok().unwrap_or_else(|| sys::panic())
}