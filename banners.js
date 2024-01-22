const express = require("express");
const router = express.Router();
const db = require("../models");
const Banners = db.banners;

router.all("/add", async (req, res) => {
    try {
        console.log( req.body, " = 관리자에 의한 배너이미지 추가" );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['이 요청은 관리자분만이 하실수 있습니다'] });
        if ( !req.body.image )
            return res.status(200).json({ status: false, msg: ['추가할 이미지를 선택하세요']});
        let temp = await Banners.findAll({
            where: { deleted: null }
        });
        if ( temp && temp.length > 0 )
            return res.status(200).json({ status: false, msg: ['이미 등록된 배너가 존재합니다']});
        await Banners.create({
            image: req.body.image,
            state: req.body.state === true,
            created: new Date().toUTCString(),
        });
        return res.status(200).json({ status: true, msg: ['홈배너이미지가 성공적으로 추가되었습니다']});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString() ]});
    }
});
router.all("/update", async (req, res) => {
    try {
        console.log( req.body, " = 관리자에 의한 배너이미지 수정" );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['이 요청은 관리자분만이 하실수 있습니다'] });
        if ( !req.body.image || !req.body.banner_id || req.body.state === null || req.body.state === undefined )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다. 요구되는 파라미터형식이 아닙니다']});

        let temp = await Banners.findAll({
            where: {
                id: Number( req.body.banner_id ),
                deleted: null,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['이러한 배너는 존재하지 않습니다']});
        await Banners.update({
            image: req.body.image,
            state: req.body.state === true,
            updated: new Date().toUTCString(),
        }, {
            where: { id: Number( req.body.banner_id ), }
        });
        return res.status(200).json({ status: true, msg: ['홈배너이미지가 성공적으로 업데이트되었습니다']});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString() ]});
    }
});
router.all("/get-one", async (req, res) => {
    try {
        console.log( req.body, " = 배너이미지 상세정보 얻기" );
        let temp = await Banners.findOne({
            where: { deleted: null, },
            attributes: [ 'id', 'image', 'created', 'updated', 'state' ],
        });
        return res.status(200).json({ status: true, results: temp });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString() ]});
    }
});
router.all("/delete", async (req, res) => {
    try {
        console.log( req.body, " = 관리자에 의한 배너이미지 삭제" );
        if ( req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['이 요청은 관리자분만이 하실수 있습니다'] });
        if ( !req.body.banner_id )
            return res.status(200).json({ status: false, msg: ['삭제할 배너이미지를 선택하세요']});
        let temp = await Banners.findOne({
            where: {
                id: Number( req.body.banner_id ),
                deleted: null,
            }
        });
        if ( !temp ) {
            return res.status(200).json({ status: false, msg: ['요청하신 배너는 존재하지 않습니다']});
        }
        await Banners.update({
            deleted: new Date().toUTCString(),
        }, {
            where: {
                id: Number( req.body.banner_id ),
            }
        });
        return res.status(200).json({ status: true, msg: ['홈배너이미지가 성공적으로 삭제되었습니다']});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString() ]});
    }
});
module.exports = router;