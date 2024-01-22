const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const db = require("../models");
const Users = db.users;
const Initials = db.initials;

const generateSecurityToken = require("../utils/generateToken");
const validatePhone = require("../validation/validatePhone");
const generateOtpCode = require("../utils/generateOtpCode");
const verifyToken = require("../validation/jwtTokenVerify");
const validateRegisterUser = require("../validation/registerUser");
const sendSMSTemplate = require("../utils/sms");

const CONFIG = require("../config/config");

const multer = require('multer');
const {v4: uuidv4} = require('uuid');
const DIR = "./public/docs";
const fs = require('fs');
'use strict';
/********************************** 인증코드 보내기 ************************************/
router.all("/get-code", async ( req, res) => {
    try {
        console.log( req.body, " = 인증코드보내기 ");
        if ( !req.body.phone )
            return res.status(200).json( { status: false, msg: [ '잘못된 요청입니다' ] } );
        else {
            const { msg, isValid } = await validatePhone( req.body );
            if (!isValid) {
                return res.status(200).json({status: false, msg: msg});
            }

            // let user_temp = await Users.findOne({
            //     where: {
            //         phone: req.body.phone,
            //     },
            // });
            // if ( !user_temp )
            /** OTP코드 얻기 **/
            let get_code = await generateOtpCode();

            /** test를 위한 코드 **/
            let test_flag = false;
            let phone_array = [
                '01012345670', '01012345671', '01012345672', '01012345673', '01012345674', '01012345675', '01012345676', '01012345677', '01012345678', '01012345679',
                '01012345680', '01012345681', '01012345682', '01012345683', '01012345684', '01012345685', '01012345686', '01012345687', '01012345688', '01012345689',
                '01012345690', '01012345691', '01012345692', '01012345693', '01012345694', '01012345695', '01012345696', '01012345697', '01012345698', '01012345699',
            ];
            if (phone_array.includes( req.body.phone)) {
                get_code = {
                    status: true,
                    results: "123456",
                };
                test_flag = true;
            }

            /** 공개열쇠암호에 의한 토큰생성하기 **/
            if ( get_code.status ) {
                const payload = {
                    code: get_code.results,
                    phone: req.body.phone,
                };
                // Token signing options
                const signOptions = {
                    issuer: CONFIG.iss,			        // Issuer (Software organization who issues the token)
                    subject: CONFIG.sub,			    // Subject (intended user of the token)
                    audience: CONFIG.SIM_API_URL,	    // Audience (Domain within which this token will live and function)
                    expiresIn: CONFIG.EXPIRESIN_CODE,
                    algorithm: "RS256",
                };
                // Sign token
                const token = await jwt.sign(payload, CONFIG.PRIVATE_KEY, signOptions);

                /** 비즈톡에 의한 sms문자전송 **/
                let data = {
                    phone: req.body.phone,
                    msg: "[팝업플레이스] 인증번호 [" + get_code.results + "]를 입력해주세요.",
                };

                if ( !test_flag )
                    await sendSMSTemplate(data);
                return res.status(200).json({status: true, results: get_code.results, token: token });

            } else
                return res.status(200).json({ status: false, msg: ["통신도중 오류가 발생하였습니다"]});
        }
    } catch (e) {
        return res.status( 200 ).json({ status: false, msg: [ e.toString() ] } );
    }
} );
/********************************** 인증코드 체크하기 ************************************/
/**********************************   사용자 로그인   ************************************/
router.all("/login-user", async ( req, res) => {
    try {
        console.log( req.body.code, " = 인증코드 확인 및 로그인 ");
        let temp = await verifyToken(req.body, CONFIG.EXPIRESIN_CODE);
        if ( temp.state ) {
            let phone = temp.result.payload.phone;
            if ( req.body.code !== temp.result.payload.code )
                return res.status(200).json({ status: false, msg: ['인증코드를 정확하게 입력하세요']});

            let user = await Users.findOne({
                where: {
                    phone: phone,
                },
            });

            if ( !user ) {
                let list = await Users.findAll({
                    attributes: [ 'nickname' ],
                });
                let temp = list.map( ( item ) => item.nickname );
                return res.status(200).json({status: true, msg: ['인증이 확인되었습니다'], flag: "신규", nicknameList: temp } );
            } else {
                if (user.deleted) {
                    return res.status(200).json({status: false, msg: ['관리자분에 의하여 이미 삭제된 사용자입니다']});
                }
                /**
                 * 앱접속시간 업데이트
                 * 로그인 횟수 업뎃하기
                 */
                let user_temp = await Users.findOne({
                    where: {
                        phone: phone,
                    },
                });

                let unit = 10 * 60 * 1000; // 10분
                let last_connected = new Date(user_temp.last_connected).getTime();
                let last_calculated = (new Date( user_temp.last_calculated )).getTime();
                let current_time = new Date().getTime();
                let temp;
                if ( current_time - last_connected >= unit ) {
                    temp = {
                        last_connected: current_time,
                        last_calculated: current_time,
                        eccumulated: user_temp.eccumulated + Math.floor( ( last_connected - last_calculated ) / 1000 ),
                        logins: user.logins + 1,
                    }
                } else {
                    temp = {
                        last_connected: current_time,
                        logins: user.logins + 1,
                    }
                }
                await Users.update( temp,
                    {
                        where: {
                            phone: phone,
                        }
                    });

                let token = await generateSecurityToken(user);
                if (token.status === false) {
                    return res.status(200).json({status: false, msg: [token.flag]});
                } else {
                    const temp = Object.assign({}, user['dataValues'], {token: token.result});
                    return res.status(200).json({status: true, results: temp});
                }
            }
        }
        else
            return res.status(200).json({status: false, msg: [ temp.msg ]});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/********************************** 닉네임 중복확인 ************************************/
router.all("/validate-nickname", async ( req, res ) => {
    try {
        console.log(req.body, " = 닉네임 중복확인");
        if ( req.body.nickname ) {
            let userList = await Users.findOne( {
                where: { nickname: req.body.nickname },
                attributes: [ 'nickname' ],
            } );
            if ( userList )
                return res.status(200).json({ status: false, msg: [ '중복된 닉네임이 이미 존재합니다' ]});
            else
                return res.status(200).json({ status: true, msg: [ '등록가능한 닉네임입니다' ]});
        } else
            return res.status(200).json({ status: false, msg: [ '잘못된 요청입니다' ]});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] });
    }
} );

/********************************** 사용자 등록 ************************************/
router.all("/register-user", async (req, res) => {
    try {
        console.log( req.body, " = 사용자등록");
        const { msg, isValid } = await validateRegisterUser( req.body );
        if (!isValid) {
            return res.status(200).json({status: false, msg: msg});
        }
        /** 닉네임중복확인 **/
        let temp_nickname = await Users.findOne({
            where: {
                nickname: req.body.nickname,
            }
        });
        if ( temp_nickname )
            return res.status(200).json({ status: false, msg: ['이미 다른 사용자에 의하여 이용되고 있는 닉네임입니다']});
        /** 폰번호 중복확인 **/
        let temp_phone = await Users.findOne({
            where: {
                phone: req.body.phone,
            }
        });
        /** 이미 삭제된 폰번호에 의한 가입 허용 **/
        if ( temp_phone ) {
            if ( temp_phone.deleted ) {
                // return res.status(200).json({ status: false, msg: [ '이미 관리자에 의하여 삭제된 폰번호입니다' ]});
            } else
                return res.status(200).json({ status: false, msg: [ '이미 다른 사용자에 의하여 이용되고 있는 폰번호입니다' ]});
        }
        const new_user = {
            name: req.body.name,
            nickname: req.body.nickname,
            phone: req.body.phone,
            address: req.body.address,
            address_detail: req.body.address_detail,
            device_type: req.body.device_type.toLowerCase(),
            longitude: Number(req.body.longitude),
            latitude: Number(req.body.latitude),
            created: new Date().toUTCString(),
            updated: new Date().toUTCString(),
            last_connected: new Date().toUTCString(),
            last_calculated: new Date().toUTCString(),
        };
        await Users.create( new_user );
        let temp = await Users.findOne({
            where: {
                nickname: req.body.nickname,
                phone: req.body.phone,
            },
        });
        let token = await generateSecurityToken(temp);
        if ( token.status === false )
            return res.status(200).json({ status: false, msg: [ token.flag ]});
        const results = Object.assign({}, temp['dataValues'], {token: token.result});
        return res.status(200).json({ status: true, results: results, msg: ['사용자등록이 성공하였습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ] });
    }
});
/********************************** 닉네임 리스트얻기 ************************************/
router.all("/get-nicknames", async (req, res) => {
    try {
        console.log( req.body, ' = 닉네임리스트 얻기');
        let list = await Users.findAll({
            attributes: [ 'nickname' ],
        });
        let temp = list.map( ( item ) => item.nickname );
        return res.status(200).json({status: true, results: temp});
    } catch (e) {
        return res.status(200).json({status: false, msg: [ e.toString() ]});
    }
});
/********************************** 이미지 업로드하기 ************************************/
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DIR);
    },
    filename: (req, file, cb) => {
        const re = /[^a-z0-9.]+/gi;
        const fileName = file.originalname.toLowerCase().split(' ').join('-').replace(re, "");
        cb(null, uuidv4() + '-' + fileName);
    }
});
let imageUpload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});
router.all("/image-upload", imageUpload.single('selectedFile'), (req, res, next) => {
    try {
        const fileUrl = 'docs/' + req.file.filename;
        return res.status(200).json({status: true, results: fileUrl});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/********************************** 이미지 삭제하기 ************************************/
router.all("/delete-image", async (req, res) => {
    let file_path = req.body.url;
    try {
        if (!file_path)
            return res.status(200).json({status: false, msg: ['잘못된 요청입니다.']});
        else {
            file_path = "public/" + file_path;
            fs.unlinkSync(file_path);
            return res.status(200).json({status: true, msg: ["이미지가 성공적으로 삭제되었습니다"]});
        }
    } catch (err) {
        // handle the error
        console.log(err.toString());
        return res.status(200).json({status: false, msg: [err.toString()]});
    }
});
router.all("/login-admin", async ( req, res ) => {
    try {
        console.log(req.body, " = 관리자 로그인 ");
        if ( !req.body.admin_id || !req.body.password )
            return res.status(200).json({ status: false, msg: ['입력필드들을 정확하게 채우세요']});
        let temp = await Users.findOne({
            where: {
                role: "admin",
                admin_id: req.body.admin_id,
                admin_password: req.body.password,
                deleted: null,
            },
            attributes: [ 'id', 'admin_id', 'admin_password', 'created' ]
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['이러한 관리자는 존재하지 않습니다']});
        else {
            let token = await generateSecurityToken(temp);
            if (token.status === false) {
                return res.status(200).json({status: false, msg: [token.flag]});
            } else {
                const results = Object.assign({}, temp['dataValues'], {token: token.result});
                return res.status(200).json({status: true, results: results});
            }
        }
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString() ] } );
    }
});
/*********************************************************************************************************************
*****************************************       기초정보 관리        *************************************************
*********************************************************************************************************************/
/** 사용자테이블에 관리자추가하기 **/
router.all("/register-admin", async ( req, res ) => {
    try {
        console.log("관리자 추가하기");
        let temp = await Users.findOne({
            where: {
                role: "admin",
                deleted: null,
            }
        });
        if ( temp )
            return res.status(200).json({ status: false, msg: ['이미 관리자가 등록되어 있습니다']});
        await Users.create({
            role: "admin",
            admin_id: CONFIG.ADMIN_ACCOUNT.id,
            admin_password: CONFIG.ADMIN_ACCOUNT.psw,
            created: new Date().toUTCString(),
            updated: new Date().toUTCString(),
        });
        return res.status(200).json({ status: true, msg: ['관리자등록이 성공하였습니다']});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/** 기초정보테이블에 기초정보 초기값들을 채우기 **/
router.all("/initial-values", async ( req, res ) => {
    try {
        let temp = await Initials.findAll({});
        if ( temp.length > 0 )
            return res.status(200).json({ status: false, msg: ['기초테이블이 이미 초기화되어 있습니다']});
        if ( !req.body.brokerage_fee || !req.body.points_percentage || !req.body.settlement_period )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다'] });
        await Initials.create({
            brokerage_fee: Number( req.body.brokerage_fee ),
            points_percentage: Number( req.body.points_percentage ),
            settlement_period: Number( req.body.settlement_period ),
            created: new Date().toUTCString(),
        });
        return res.status(200).json({ status: true, msg: ['기초테이블의 초기화가 성공하였습니다']});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});

////////////////////////////////////////////////////// 결제하기
router.all('/return', ( req, res, next ) => {
    try {
        console.log(req, "================================= req " );
        return res.status(200).json({ status: true, msg: "return" } );
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]})
    }
} );
router.all('/close', ( req, res ) => {
    try {
        console.log(req.query, "================================= close " );
        res.send('<script language="javascript" type="text/javascript" src="https://tstdpay.paywelcome.co.kr/stdjs/INIStdPay_close.js" charset="UTF-8"></script>');
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]})
    }
} );
router.all('/popup', ( req, res ) => {
    try {
        console.log(req.body, "================================= popup " );
        res.send('<script language="javascript" type="text/javascript" src="https://tstdpay.paywelcome.co.kr/stdjs/INIStdPay_popup.js" charset="UTF-8"></script>');
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]})
    }
} );
module.exports = router;