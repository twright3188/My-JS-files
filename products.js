const express = require("express");
const router = express.Router();
const {Op, Sequelize} = require("sequelize");
const sharp = require('sharp');
const db = require("../models");
const Products = db.products;
const ProductContents = db.productContents;
const SalesHistories = db.salesHistories;
const Points = db.points;
const Favorites = db.favorites;
const Togethers =db.togethers;
const Users = db.users;
const Commits = db.commits;
const Angcols = db.angcols;
const Initials = db.initials;
const Alarms = db.alarms;
const validateRegisterProducts = require("../validation/registerProducts");
const generateCommitTree = require("../utils/generateCommitTree");
const sendFCM = require("../utils/sendPush");
const config = require("../config/config");

const calcDistance = require("../utils/calcDistance")
/***********************************************************************************************************************
*********************************************           공구마켓         ************************************************
***********************************************************************************************************************/
/**
 * 공구마켓 등록하기
 */
router.all("/add-product", async (req, res) => {
    try {
        // let str = "\"[\\\"docs/06befc3c-97fa-4b16-8064-614b0d8bf484-searchimg112.jpg\\\",\\\"docs/42c8134c-d162-4f73-ab46-de4d2b0c1d3f-searchimg142.jpg\\\",\\\"docs/d3425fdc-7af4-4340-9609-986f4b5e0e7c-searchimg51.jpg\\\",\\\"docs/09945e4e-8c82-43f8-824a-e9a9106036e1-3.jpg\\\"]\"";
        // return res.status(200).json({ list: JSON.parse( str )});
        console.log( req.body, " = 공구등록하기111 " );
        const { msg, isValid } = await validateRegisterProducts(req.body);

        if (!isValid) {
            return res.status(200).json({status: false, msg: msg});
        }
        const temp = await Products.findOne({
            where: {
                product_role: "product",
                name: req.body.name,
                deleted: null
            }
        });
        if ( temp )
            return res.status(200).json({ status: false, msg: ['같은 이름을 가진 공구가 이미 등록되어 있습니다']});
        let thumbnails = [];
        for ( let k = 0; k < JSON.parse( req.body.images ).length; k ++ ) {
            let tmp = JSON.parse( req.body.images )[ k ].replace( "docs/", "" );
            let thumbnail = 'docs/' + 'thumbnails-' + Date.now() + tmp;
            sharp('public/' + JSON.parse( req.body.images )[ k ]).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(resizeImage);
                }
            });
            thumbnails.push( thumbnail );
        }

        let initial_date = await Initials.findOne({
            where: { id: 1 }
        });
        /**
         * 공구 종료일
         * 픽업/배일일 후 3일후
         */
        var ended_date = new Date( req.body.finish_date.toString() );
        if ( Number(req.body.method) != 1 )
        {
            ended_date = new Date( req.body.delivery_date );
            
        }
        ended_date.setDate( ended_date.getDate() + 3 );  // 픽업/배달일이 있으면 그날로부터 3일후, 없으면 공구 마감일로부터 3일후
        /**
         * 정산일
         * 공구종료일 + 정산기간
         */
        let settlement_date = new Date( ended_date.toString() );
        // 공휴일수 계산
        let day = new Date( ended_date.toString() ).getDay();
        var array1 =  [ 0,  6 ];   //[ 0, 5, 6 ]; // 일, 금, 토
   
        let count = 0;
        for ( let i = 1; i <= initial_date.settlement_period; i ++ ) {
            let temp = (day + i) % 7;
            if ( array1.includes( temp ) )
                count += 1;
        }
       settlement_date.setDate( settlement_date.getDate() + initial_date.settlement_period + count );

        let product = await Products.create({
            product_role: "product",
            user_id: req.body.jwt_data.id,
            finish_date: req.body.finish_date,
            counts: req.body.counts,
            method: req.body.method,
            delivery_date: req.body.delivery_date || null,
            images: req.body.images,
            thumbnails: JSON.stringify( thumbnails ),
            name: req.body.name,
            details: req.body.details,
            created: new Date().toUTCString(),
            state: req.body.is_ad ? 101 : 1,
            active_state: true,
            p_apply_percentage: initial_date.points_percentage,
            brokerage_fee: initial_date.brokerage_fee,
            settlement_period: initial_date.settlement_period,
            ended_date: ended_date,
            settlement_date: settlement_date,
            is_ad:true,
            range: Number(req.body.range),
            longitude: Number(req.body.longitude),
            latitude: Number(req.body.latitude),
            address: req.body.address,
            address_detail: req.body.address_detail,
        });
        let main_products = JSON.parse( req.body.main_products );
        for ( let k = 0; k < main_products.length; k ++ ) {
            await ProductContents.create({
                product_id: product['dataValues'].id,
                role: "main",
                name: main_products[ k ].name,
                price: main_products[ k ].price,
                created: new Date().toUTCString(),
            });
        }
        let additional_products = JSON.parse(req.body.additional_products);
        for ( let k = 0; k < additional_products.length; k ++ ) {
            await ProductContents.create({
                product_id: product['dataValues'].id,
                role: "add",
                name: additional_products[ k ].name,
                price: additional_products[ k ].price,
                created: new Date().toUTCString(),
            });
        }
        return res.status(200).json({ status: true, msg: ['공구가 성공적으로 추가되었습니다'], results: product['dataValues'].id } );
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/**
 * 공구 상세정보 얻기
 * 하트클릭 상태
 */
router.all("/get-product-one", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body.id, " = 공구 상세정보 얻기 ");
        if ( !req.body.id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다. 공구를 선택하세요']});
        let temp = await Products.findOne({
            where: {
                product_role: "product",
                id: req.body.id,
                deleted: null,
                active_state: true,
                // state: 1,        // 진행중에 있는 공구 필터하기
            },
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'name', 'nickname', 'photo', 'thumbnail' ],
                required: true,
            }, {
                as: "productContents",
                model: ProductContents,
                where: {
                    product_id: Number( req.body.id ),
                    deleted: null,
                },
                attributes: [ 'id', 'role', 'name', 'price' ]
            }, {
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    final_ended: null,                    // 아직 정산기간에 있는 구매이력만
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",                     // 판매된 히스토리
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                required: false,
            }, {
                as: "angcols",
                model: Angcols,
                attributes: [ 'id', 'user_id', 'created' ],
                where: {
                    deleted: null,
                },
                required: false,
                order: [['created', 'DESC']],
                // limit: 5,
                include: [{
                    as: "angcolUser",                         // 앵콜외친 사용자
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
            },]
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['요청하신 공구는 존재하지 않습니다']});
        else if ( !temp.active_state && req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태로 설정되어 있는 공구입니다']});

        let favorites = await Favorites.findOne({
            where: {
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.id ),
            }
        });
     
        temp['dataValues'].angcols =  temp['dataValues'].angcols.sort(function(a, b) {
            var t1 = new Date(a.created);
            var t2 =  new Date(b.created);
            if(t1 > t2)
            {
                return -1;
            } 
            if(t1 < t2)
            {
                return 1;
            }
            return 0;
        });
        temp['dataValues'].salesHistories =  temp['dataValues'].salesHistories.sort(function(a, b) {
            var t1 = new Date(a.created);
            var t2 =  new Date(b.created);
            if(t1 > t2)
            {
                return -1;
            } 
            if(t1 < t2)
            {
                return 1;
            }
            return 0;
        });
        // console.log("ancol=>", temp['dataValues'].angcols);
        let flag = favorites ? favorites.state : false;
        temp['dataValues'] = Object.assign( {}, temp['dataValues'], { favorite: flag });
        return res.status(200).json({ status: true, results: temp});
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/**
 * 내 공구 참여인원리스트 얻기
 * 하트클릭 상태
 * none_method === "none"인 경우 전달 완료로 처리
 */
router.all("/get-product-participates", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 내 공구 참여인원리스트 체크 얻기 ");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다. 공구를 선택하세요']});
        let temp = await Products.findOne({
            where: {
                product_role: "product",
                id: Number(req.body.product_id),
                deleted: null,
            },
            include: [{
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    final_ended: null,                    // 진행중에 있는 공구만
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail', 'name', 'nickname'],
                }],
                order: [['created', 'DESC']],
            }]
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['요청하신 공구는 존재하지 않습니다']});
        else if ( temp.user_id !== req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님이 등록하신 공구에 대해서만 이 요청을 하실수 있습니다']});
        else if ( !temp.active_state && req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태로 설정되어 있는 공구입니다']});

        let list = temp.salesHistories;
        let keyword = req.body.keyword;
        if ( keyword ) {
            list = [];
            for ( let k = 0; k < temp.salesHistories.length; k ++ ) {
                let item = temp.salesHistories[ k ];
                if ( ( item.buyer_phone && item.buyer_phone === keyword && keyword.length < 4 ) || 
                    ( item.buyer_phone && item.buyer_phone.indexOf(keyword) !== -1 && keyword.length > 3) ||
                    ( item.buyer_address && item.buyer_address.includes( keyword ) ) ||
                    ( item.purchaseUser && item.purchaseUser.name && item.purchaseUser.name === keyword ) ||
                    ( item.purchaseUser && item.purchaseUser.nickname && item.purchaseUser.nickname === keyword ) ) {
                    list.push( item );
                }
            }
        }

        let favorites = await Favorites.findOne({
            where: {
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.product_id ),
            }
        });
        let flag = favorites ? favorites.state : false;
        temp = Object.assign( {}, temp['dataValues'], { salesHistories: list, favorite: flag });
        return res.status(200).json({ status: true, results: temp});
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});

/**
 * 공구 수정하기
 * 공구기간중인 수정은 상품이미지, 상품명, 상품설명만 수정가능
 * 앵콜외쳐의 경우 기존 존재하던 정보 통채로 업데이트시키도록 구현됨
 */
router.all("/update-product", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 공구 업뎃하기 ");

        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['공구를 정확하게 선택하세요']});
        let temp  = await Products.findOne({
            where: {
                product_role: "product",
                id: Number( req.body.product_id ),
                active_state: true,
                deleted: null,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['존재하지 않는 레코드입니다']});
        else if ( temp.user_id !== req.body.jwt_data.id && req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['고객님의 권한으로는 이 공구를 수정하실수 없습니다']});

        // if ( new Date( temp.finish_date ).getTime() >= new Date().getTime() ) {
        if ( temp.state === 1 ) {
            //    현재 공구 기간중에 있는 경우
            if ( req.body.finish_date || req.body.counts || req.body.method || req.body.delivery_date || req.body.main_products || req.body.additional_products )
                return res.status(200).json({ status: false, msg: ['기간중에 있는 공구는 상품이미지, 상품명, 상품설명만 수정이 가능합니다']});
            else if ( !req.body.images || !req.body.name || !req.body.details )
                return res.status(200).json({ status: false, msg: ['입력필드들을 정확하게 채우세요']});
            else if ( req.body.images.length > 4 )
                return res.status(200).json({ status: false, msg: ['상품사진등록은 4장까지가 가능합니다']});
            // else if(temp.name != req.body.name) {
            //     const buf = await Products.findOne({
            //         where: {
            //             product_role: "product",
            //             id: {[Op.ne]: Number( req.body.product_id ) },
            //             name: req.body.name,
            //             deleted: null,
            //         }
            //     });
            //     if ( buf )
            //         return res.status(200).json({ status: false, msg: ['같은 이름을 가진 공구가 존재합니다']});
            // }

            let thumbnails = [];
            for ( let k = 0; k < req.body.images.length; k ++ ) {
                let tmp = req.body.images[ k ].replace( "docs/", "" );
                let thumbnail = 'docs/' + 'thumbnails-' + Date.now() + tmp;
                sharp('public/' + req.body.images[ k ]).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(resizeImage);
                    }
                });
                thumbnails.push( thumbnail );
            }

            await Products.update({
                images: JSON.stringify( req.body.images ),
                thumbnails: JSON.stringify( thumbnails ),
                name: req.body.name,
                details: req.body.details,
                updated: new Date().toUTCString(),
                state: 1,
                active_state: true,
            }, {
                where: {
                    id: Number( req.body.product_id ),
                }
            });
            return res.status(200).json({ status: true, msg: ['공구가 성공적으로 업뎃되었습니다']});
        } else if ( temp.state === 4 || temp.state === 5) {
            // resell product
         
        
            const { msg, isValid } = await validateRegisterProducts(req.body);
            if (!isValid) {
                return res.status(200).json({status: false, msg: msg});
            }
       
        
            let thumbnails = [];
            for ( let k = 0; k < JSON.parse( req.body.images ).length; k ++ ) {
                let tmp = JSON.parse( req.body.images )[ k ].replace( "docs/", "" );
                let thumbnail = 'docs/' + 'thumbnails-' + Date.now() + tmp;
                sharp('public/' + JSON.parse( req.body.images )[ k ]).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(resizeImage);
                    }
                });
                thumbnails.push( thumbnail );
            }

            await ProductContents.destroy({
                where: {
                    product_id: Number( req.body.product_id ),
                }
            });
            let initial_date = await Initials.findOne({
                where: { id: 1 }
            });

            /**
                 * 공구 종료일
                 * 픽업/배일일 후 3일후
                 */
            var ended_date = new Date( req.body.finish_date.toString() );
            if ( Number(req.body.method) != 1 )
            {
                ended_date = new Date( req.body.delivery_date );
               
            }
            ended_date.setDate( ended_date.getDate() + 3 );  // 픽업/배달일이 있으면 그날로부터 3일후, 없으면 공구 마감일로부터 3일후   
            /**
             * 정산일
             * 공구종료일 + 정산기간
             */
            let settlement_date = new Date( ended_date.toString() );
            // 공휴일수 계산
            let day = new Date( ended_date.toString() ).getDay();
            var array1 =  [ 0,  6 ];   //[ 0, 5, 6 ]; // 일, 금, 토

            let count = 0;
            for ( let i = 1; i <= initial_date.settlement_period; i ++ ) {
                let temp = (day + i) % 7;
                if ( array1.includes( temp ) )
                    count += 1;
            }
            settlement_date.setDate( settlement_date.getDate() + initial_date.settlement_period + count );

            await Products.update({
                active_state: false,
            }, {
                where: {
                    id: Number( req.body.product_id ),
                }
            });
            const oldone = await Products.findOne({
                where: {
                    id: Number( req.body.product_id ),
                }
            });
            let cproduct = await Products.create({
                product_role: "product",
                user_id: req.body.jwt_data.id,
                finish_date: req.body.finish_date,
                counts: req.body.counts,
                method: req.body.method,
                delivery_date: req.body.delivery_date || null,
                images: req.body.images,
                thumbnails: JSON.stringify( thumbnails ),
                name: req.body.name,
                details: req.body.details,
                created: new Date().toUTCString(),
                state:  1,
                active_state: true,
                p_apply_percentage: initial_date.points_percentage,
                brokerage_fee: initial_date.brokerage_fee,
                settlement_period: initial_date.settlement_period,
                ended_date: ended_date,
                settlement_date: settlement_date,
                range:oldone['dataValues'].range,
                longitude: oldone['dataValues'].longitude,
                latitude: oldone['dataValues'].latitude,
                address: oldone['dataValues'].address,
                address_detail: oldone['dataValues'].address_detail,
            });
            let main_products = JSON.parse( req.body.main_products );
            for ( let k = 0; k < main_products.length; k ++ ) {
                await ProductContents.create({
                    product_id: Number(cproduct.id),
                    role: "main",
                    name: main_products[ k ].name,
                    price: main_products[ k ].price,
                    created: new Date().toUTCString(),
                });
            }
            let additional_products = JSON.parse(req.body.additional_products);
            for ( let k = 0; k < additional_products.length; k ++ ) {
                await ProductContents.create({
                    product_id: Number( cproduct.id ),
                    role: "add",
                    name: additional_products[ k ].name,
                    price: additional_products[ k ].price,
                    created: new Date().toUTCString(),
                });
            }
            await Favorites.update({
                product_id: Number( cproduct.id ) ,
            }, {
                where: {
                    product_id : Number( req.body.product_id)
                }
            });
            /**
             * favorite 회원들에게 알림 보내기
             */

            let fUsers = await Favorites.findAll({
                where: {
                    product_id: Number( cproduct.id ),
                    state: true,
                },
            });
           
            let title = "[공구마켓] " + req.body.name;
            let content = '다시 판매를 시작했어요. 얼른 공구에 참여해주세요.';
            let product_id = Number( cproduct.id );

            let tokens = [];
            for ( let i = 0; i < fUsers.length; i ++ ) {
                let ff_user = await Users.findOne({            
                    where: {               
                         id: Number( fUsers[ i ].user_id ),                
                         deleted: null,            
                        },           
                     attributes: [ 'push_token', 'name', 'comment_notification', 'angol_notification', 'tool_notification', 'delivery_notification' ]       
                 });
                 if(ff_user.tool_notification)
                 {
                    await Alarms.create({
                        user_id: Number( fUsers[ i ].user_id ),
                        product_role: "product",
                        product_id: product_id,
                        contents: content,
                        title: title,
                        created: new Date().toUTCString(),
                    });
                    if ( ff_user.push_token)
                        tokens.push( ff_user.push_token );
                 }
            }
            if ( tokens.length > 0 ) {
                const push_message = {
                    type: "PRODUCT RESTART",
                    title: title,
                    body: content,
                    product_role: "product",
                    product_id: product_id,
                    token: tokens,
                };
                await sendFCM(push_message);
            }
            return res.status(200).json({ status: true, product_id:Number( cproduct.id ), msg: ['공구가 성공적으로 업뎃되었습니다']});
        } else if( temp.state > 100)
        {
            // 앵콜외쳐요 공구 수정하기
           
            const { msg, isValid } = await validateRegisterProducts(req.body);
            if (!isValid) {
                return res.status(200).json({status: false, msg: msg});
            }
           

            let thumbnails = [];
            for ( let k = 0; k < JSON.parse( req.body.images ).length; k ++ ) {
                let tmp = JSON.parse( req.body.images )[ k ].replace( "docs/", "" );
                let thumbnail = 'docs/' + 'thumbnails-' + Date.now() + tmp;
                sharp('public/' + JSON.parse( req.body.images )[ k ]).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(resizeImage);
                    }
                });
                thumbnails.push( thumbnail );
            }

            await ProductContents.destroy({
                where: {
                    product_id: Number( req.body.product_id ),
                }
            });
            let initial_date = await Initials.findOne({
                where: { id: 1 }
            });
           


            /**
                * 공구 종료일
                * 픽업/배일일 후 3일후
            */
            var ended_date = new Date( req.body.finish_date.toString() );
            if ( Number(req.body.method) != 1 )
             {
                ended_date = new Date( req.body.delivery_date );
               
            }
            ended_date.setDate( ended_date.getDate() + 3 );  // 픽업/배달일이 있으면 그날로부터 3일후, 없으면 공구 마감일로부터 3일후                 
             /**
                * 정산일
                * 공구종료일 + 정산기간
             */
            let settlement_date = new Date( ended_date.toString() );
            // 공휴일수 계산
            let day = new Date( ended_date.toString() ).getDay();
            var array1 =  [ 0,  6 ];   //[ 0, 5, 6 ]; // 일, 금, 토
             
            let count = 0;
            for ( let i = 1; i <= initial_date.settlement_period; i ++ ) {
                let temp = (day + i) % 7;
                if ( array1.includes( temp ) )
                    count += 1;
                }
            settlement_date.setDate( settlement_date.getDate() + initial_date.settlement_period + count );
            
            const oldone = await Products.findOne({
                where: {
                    id: Number( req.body.product_id ),
                }
            });
            await Products.update({
                user_id: req.body.jwt_data.id,
                finish_date: req.body.finish_date,
                counts: req.body.counts,
                method: req.body.method,
                delivery_date: req.body.delivery_date,
                images: req.body.images,
                thumbnails: JSON.stringify( thumbnails ),
                name: req.body.name,
                details: req.body.details,
                updated: new Date().toUTCString(),
                state: 1,
                active_state: true,
                p_apply_percentage: initial_date.points_percentage,
                brokerage_fee: initial_date.brokerage_fee,
                settlement_period: initial_date.settlement_period,
                ended_date: ended_date,
                settlement_date: settlement_date,

                range:oldone['dataValues'].range,
                longitude: oldone['dataValues'].longitude,
                latitude: oldone['dataValues'].latitude,
                address: oldone['dataValues'].address,
                address_detail: oldone['dataValues'].address_detail,

                final_ended: null,
                created: new Date().toUTCString(),       // 공구 재시작할 경우 판매일자도 함께 업뎃하기
            }, {
                where: {
                    id: Number( req.body.product_id ),
                }
            });
            let main_products = JSON.parse( req.body.main_products );
            for ( let k = 0; k < main_products.length; k ++ ) {
                await ProductContents.create({
                    product_id: Number( req.body.product_id ),
                    role: "main",
                    name: main_products[ k ].name,
                    price: main_products[ k ].price,
                    created: new Date().toUTCString(),
                });
            }
            let additional_products = JSON.parse(req.body.additional_products);
            for ( let k = 0; k < additional_products.length; k ++ ) {
                await ProductContents.create({
                    product_id: Number( req.body.product_id ),
                    role: "add",
                    name: additional_products[ k ].name,
                    price: additional_products[ k ].price,
                    created: new Date().toUTCString(),
                });
            }
            /**
             * favorite 회원들에게 알림 보내기
             */

             let fUsers = await Favorites.findAll({
                where: {
                    product_id: Number( req.body.product_id ),
                    state: true,
                },
            });
           
            let title = "[공구마켓] " + req.body.name;
            let content = '다시 판매를 시작했어요. 얼른 공구에 참여해주세요.';
            let product_id = Number( req.body.product_id );

            let tokens = [];
            for ( let i = 0; i < fUsers.length; i ++ ) {
                let ff_user = await Users.findOne({            
                    where: {               
                         id: Number( fUsers[ i ].user_id ),                
                         deleted: null,            
                        },           
                     attributes: [ 'push_token', 'name', 'comment_notification', 'angol_notification', 'tool_notification', 'delivery_notification' ]       
                 });
                 if(ff_user.tool_notification)
                 {
                    await Alarms.create({
                        user_id: Number( fUsers[ i ].user_id ),
                        product_role: "product",
                        product_id: product_id,
                        contents: content,
                        title: title,
                        created: new Date().toUTCString(),
                    });
                    if ( ff_user.push_token)
                        tokens.push( ff_user.push_token );
                 }
            }
            if ( tokens.length > 0 ) {
                const push_message = {
                    type: "PRODUCT RESTART",
                    title: title,
                    body: content,
                    product_role: "product",
                    product_id: product_id,
                    token: tokens,
                };
                await sendFCM(push_message);
            }
            return res.status(200).json({ status: true,  product_id: Number( req.body.product_id ), msg: ['공구가 성공적으로 업뎃되었습니다']});
        }
        else
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});

/**
 * 웹링크 생성하기
 */
router.all("/generate-link", async ( req, res) => {
    console.log(req.body.jwt_data.id, "=  웹링크생성하기");
    try {
        let types = ['bank', 'card'];
        if ( !req.body.p_price || !req.body.u_name || !req.body.product_name || !types.includes(req.body.type) )
            return res.status(200).json({ status: false, msg: ['입력필드들을 정확하게 채우세요']});
        let link = config.SIM_API_DOMAIN_URL + "payment/Request.php?";
        link += "p_price=" + encodeURI( JSON.stringify( req.body.p_price ) );
        link += "&u_name=" + encodeURI( JSON.stringify( req.body.u_name ) );
        link += "&u_phone=" + encodeURI( JSON.stringify( req.body.u_phone ) );
        link += "&p_name=" + encodeURI( JSON.stringify( req.body.product_name ) );
        link += "&p_type=" + encodeURI( JSON.stringify( req.body.type ) );
        link += "&p_noti=" + encodeURI( JSON.stringify( "" ) );
        return res.status(200).json({ status: true, results: link });
    } catch (e) {
        return res.status(200).json({ status: false, msg:[e.toString()]});
    }
});
/**
 * 공구 마켓 구매하기
 */
router.all("/payment", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 공구 마켓 구매하기");
        if ( !req.body.product_id || !req.body.purchase_details || !req.body.payment_amount || !req.body.buyer_phone || !req.body.buyer_address || !req.body.payment_method )
            return res.status(200).json({ status: false, msg: ['타당치 못한 요청입니다. 필요한 파라미터들이 입력되지 않았습니다']});
        let temp = await Products.findOne({
            where: {
                product_role: "product",
                id: Number( req.body.product_id ),
                deleted: null,
                active_state: true,
            },
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'push_token', 'comment_notification', 'angol_notification', 'tool_notification', 'delivery_notification'],
                required: true,
            }, ],
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['존재하지 않는 공구에 대한 구매요청입니다']});
        else if ( !temp.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});
        else if ( temp.state !== 1 )
            return res.status(200).json({ status: false, msg: ['기간중에 있는 공구가 아닙니다']});
        else {
            let user = await Users.findOne({
                where: {
                    id: req.body.jwt_data.id,
                }
            });
            let point = user.points || 0;
            let discount = Number( req.body.discount || 0 );
            if ( point < discount )
                return res.status(200).json({ status: false, msg: ['할인금액이 보유포인트를 초과하였습니다']});

            // 적용포인트 얻기
            let counts_purcharse = await SalesHistories.count({
                where: { 
                    product_id: Number( req.body.product_id ), 
                    deleted : null, }
            });

            if ( counts_purcharse >= Number(temp.counts) )
                return res.status(200).json({ status: false, msg: '이미 공구참여인원이 만료되었습니다' });
            
            let apply_point = Math.min( 40, temp.p_apply_percentage * ( counts_purcharse + 1 ) );   // 최대 40%까지 적용가능

            console.log( apply_point, " = apply_point" );
            await SalesHistories.create({
                product_id: Number( req.body.product_id ),
                user_id: req.body.jwt_data.id,
                payment_method: req.body.payment_method,
                payment_amount: Number( req.body.payment_amount || 0 ),
                discount: Number( req.body.discount || 0 ),
                buyer_phone: req.body.buyer_phone,
                buyer_address: req.body.buyer_address,
                purchase_details: JSON.stringify( req.body.purchase_details ),
                created: new Date().toUTCString(),
                none_method: temp.method === 1 ? "none" : null,                                                   // 공구 전달방법이 없는 경우 "none", 있으면 null
                tid:req.body.tid,
                apply_point: Math.ceil( Number( req.body.payment_amount || 0 ) * apply_point / 100 ),   // 공구 종료시 사용자에게 할당될 적립포인트
            }).then( async item => {
                await Users.update({
                    points: point - Number( req.body.discount ),
                    updated: new Date().toUTCString(),
                }, {
                    where: { id: req.body.jwt_data.id }
                });
                /**
                 * 사용 포인트 기록하기
                 * 포인트사용시의 공구명으로 기록
                 */
                if ( Number( req.body.discount ) > 0 ) {
                    await Points.create({
                        user_id: req.body.jwt_data.id,
                        product_id: Number( req.body.product_id ),
                        product_name: temp.name,
                        sales_id: item.id,
                        type: "used",
                        amount: Number( req.body.discount),
                        created: new Date().toUTCString(),
                    });
                }
            }).catch( err => {
                return res.status(200).json({ status: false, msg: [ err.toString() ] } );
            });
            /**
             * 회원이 공구 구매시 > 상품 판매자 알림
             */
            let title = "[공구마켓] " + temp.name;
            let content = req.body.jwt_data.nickname + "님이 " + ( Number( req.body.payment_amount || 0 ) - Number( req.body.discount || 0 ) ).toLocaleString('ko') + "원 공구 결제했어요.";
            if(temp.saleUser.tool_notification)
            {
                await Alarms.create({
                    user_id: Number( temp.user_id ),
                    product_role: "product",
                    product_id: Number( req.body.product_id ),
                    contents: content,
                    title: title,
                    created: new Date().toUTCString(),
                });
                if ( temp.saleUser.push_token) {
                    const push_message = {
                        type: "PAYMENT",
                        title: title,
                        body: content,
                        product_role: "product",
                        product_id: Number( req.body.product_id ),
                        token: [ temp.saleUser.push_token ],
                    };
                    await sendFCM(push_message);
                }
            }
          
            return res.status(200).json({ status: true, msg: ['결제가 성공적으로 진행되었습니다'] });
        }
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/**
 * 결제 취소하기
 */
router.all("/cancel-payment2", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 결제 취소하기 " );
        if ( !req.body.sales_id || !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});

        let payment = await SalesHistories.findOne({
            where: {
                product_id: Number( req.body.product_id ),
                id: Number( req.body.sales_id ),
                deleted : null,
                // deleted: new Date().toUTCString(),
            }
        });
        if ( !payment )
            return res.status(200).json({ status: false, msg: ['요청하신 구매내역은 존재하지 않습니다']});
        else if ( payment.user_id !== req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님은 자신의 구매한 내역에 대해서만 취소가 가능합니다']});
        else {
            let product = await Products.findOne({
                where: {
                    product_role: 'product',
                    id: Number( req.body.product_id ),
                    deleted: null,
                }
            });
            if ( ( product.state !== 1 ) )
                return res.status(200).json({ status: false, msg: ['기간중에 있는 공구에 대해서만 이 요청을 하실수 있습니다'] } );
            else if ( !product.active_state )
                return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});
        }

        let user = await Users.findOne({
            where: { id: req.body.jwt_data.id }
        });
        await Users.update({
            points: user.points + Number( payment.discount ),
        }, {
            where: { id: req.body.jwt_data.id }
        });
        await Points.destroy({
            where: { sales_id: Number( req.body.sales_id ),
                     user_id :  req.body.jwt_data.id,
                    }
        });
        // await SalesHistories.destroy({
        //     where: { id: Number(req.body.sales_id), }
        // });
        await SalesHistories.update({
            deleted: new Date().toUTCString(),
        }, {
            where: { id: Number(req.body.sales_id), }
        });
        return res.status(200).json({ status: true, msg: ['결제가 성공적으로 취소되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/**
 * 공구 전달하기
 */
router.all("/deliver", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 공구 전달하기 " );
        if ( !req.body.product_id || !req.body.sales_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});

        let product = await Products.findOne({
            where: {
                product_role: 'product',
                id: Number( req.body.product_id ),
                deleted: null,
                // state: [2, 3],
            }
        });

        if ( !product || ( product && req.body.jwt_data.id !== product.user_id ) )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        else if ( !product.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});
        let payment = await SalesHistories.findOne({
            where: {
                id: Number( req.body.sales_id ),
                delivery_date: null,
                none_method: null,                                    // 전달방법이 있는 내역
                deleted: null,
                old_product_id: null,                                 // 정산기간이 안된 히스토리
            }
        });
        if ( !payment )
            return res.status(200).json({ status: false, msg: ['요청하신 구매내역은 존재하지 않습니다']});

        await SalesHistories.update({
            delivery_date: new Date(),
        }, {
            where: {
                id: Number(req.body.sales_id),
            }
        });
        return res.status(200).json({ status: true, msg: ['전달상태가 성공적으로 업뎃되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});

/**
 * 앵콜외쳐요
 * 공구종료된 상품에 한하여 적용가능
 */
router.all("/call-angcol", async ( req, res) => {
    try {
        console.log( req.body.jwt_data.id, " = 앵콜외쳐요");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['공구를 선택하세요'] });
        let temp = await Products.findOne({
            where: {
                product_role: 'product',
                id: Number( req.body.product_id ),
                deleted: null,
                active_state: true,
            },
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'push_token', 'comment_notification', 'angol_notification', 'tool_notification', 'delivery_notification'],
                required: true,
            }, ],
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['요청하신 공구는 존재하지 않습니다']});
        else if ( temp.state !== 4 && temp.state !== 5 && (temp.state < 100))
            return res.status(200).json({ status: false, msg: ['종료된 공구에 대해서만 앵콜외침이 가능합니다']});
        else if ( !temp.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});
        let user_angcol = await Angcols.findOne({
            where: {
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.product_id ),
                deleted: null,
            }
        });
        if ( user_angcol )
            return res.status(200).json({ status: false, msg: ['고객님은 이 공구에 이미 앵콜외침을 하셨습니다.']});
        await Angcols.create({
            user_id: req.body.jwt_data.id,
            product_id: Number( req.body.product_id ),
            created: new Date().toUTCString(),
        });

        /**
         * 회원이 앵콜판매외쳐요! 할 경우 > 상품 판매자 알림
         */
        if(temp.saleUser.angol_notification)
        {
            let title = "[공구마켓] " + temp.name;
            let content = req.body.jwt_data.nickname + "님이 판매자님의 공동구매를 원해요.";
            await Alarms.create({
                user_id: Number( temp.user_id ),
                product_role: "product",
                product_id: Number( req.body.product_id ),
                contents: content,
                title: title,
                created: new Date().toUTCString(),
            });
            if ( temp.saleUser.push_token) {
                const push_message = {
                    type: "ANGCOLS",
                    title: title,
                    body: content,
                    product_role: "product",
                    product_id: Number( req.body.product_id ),
                    token: [ temp.saleUser.push_token ],
                };
                await sendFCM(push_message);
            }
        }
       

        return res.status(200).json({ status: true, msg: ['앵콜외침이 성공적으로 진행되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [e.toString()]});
    }
});
/***********************************************************************************************************************
 *********************************************           함께해요         ************************************************
 ***********************************************************************************************************************/
/**
 * 함께해요 등록하기
 */
router.all("/add-together", async (req, res) => {
    try {
        console.log( req.body, " = 함께해요 등록하기 " );

        if ( !req.body.range || !req.body.latitude || !req.body.longitude || !req.body.address )
            return res.status(200).json({ status: false, msg: ['거리범위, 주소, 위도, 경도를 정확하에 입력하세요']});
        if ( !req.body.counts || !req.body.details )
            return res.status(200).json({ status: false, msg: ['필요한 필드들을 정확하게 채우세요']});
        else if ( req.body.images && req.body.images.length > 4 )
            return res.status(200).json({ status: false, msg: ['상품사진등록은 4장까지가 가능합니다']});
        const temp = await Products.findOne({
            where: {
                product_role: "together",
                details: req.body.details,
                deleted: null
            }
        });
        if ( temp )
            return res.status(200).json({ status: false, msg: ['동일한 이야기로 등록된 레코드가 이미 존재합니다']});

        let thumbnails = [];
        if ( req.body.images ) {
            for ( let k = 0; k < req.body.images.length; k ++ ) {
                let tmp = req.body.images[ k ].replace( "docs/", "" );
                let thumbnail = 'docs/' + 'thumbnails-' + Date.now() + tmp;
                sharp('public/' + req.body.images[ k ]).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(resizeImage);
                    }
                });
                thumbnails.push( thumbnail );
            }
        }

        let product = await Products.create({
            product_role: "together",
            user_id: req.body.jwt_data.id,
            counts: req.body.counts,
            images: req.body.images ? JSON.stringify( req.body.images ) : null,
            thumbnails: req.body.images ? JSON.stringify( thumbnails ) : null,
            details: req.body.details,
            created: new Date().toUTCString(),
            state: 1,
            active_state: true,

            range: Number( req.body.range ) || 1,
            longitude: Number(req.body.longitude) || 0,
            latitude: Number(req.body.latitude) || 0,
            address: req.body.address,
            address_detail: req.body.address_detail,
        });

        return res.status(200).json({ status: true, msg: ['함께해요가 성공적으로 추가되었습니다'], results: product.id });
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/**
 * 함께해요 수정하기
 */
router.all("/update-together", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 함께해요 업뎃하기 ");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['함께해요 레코드를 정확하게 선택하세요']});
        let temp  = await Products.findOne({
            where: {
                product_role: "together",
                id: Number( req.body.product_id ),
                deleted: null,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['존재하지 않는 레코드입니다']});
        else if ( temp.user_id !== req.body.jwt_data.id && req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['고객님의 권한으로는 이 요청을 하실수 없습니다']});
        else if ( !temp.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});

        if ( temp.state === 5 )
            return res.status(200).json({ status: false, msg: ['함께해요! 참여가 마감되어 수정하실 수 없습니다.']});

        if ( !req.body.counts || !req.body.details )
            return res.status(200).json({ status: false, msg: ['입력필드들을 정확하게 채우세요']});
        else if ( req.body.images && req.body.images.length > 4 )
            return res.status(200).json({ status: false, msg: ['상품사진등록은 4장까지가 가능합니다']});

        let thumbnails = [];
        if ( req.body.images ) {
            for ( let k = 0; k < req.body.images.length; k ++ ) {
                let tmp = req.body.images[ k ].replace( "docs/", "" );
                let thumbnail = 'docs/' + 'thumbnails-' + Date.now() + tmp;
                sharp('public/' + req.body.images[ k ]).resize(128, 128).toFile( "public/" + thumbnail, (err, resizeImage) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(resizeImage);
                    }
                });
                thumbnails.push( thumbnail );
            }
        }

        await Products.update({
            images: req.body.images ? JSON.stringify( req.body.images ) : null,
            thumbnails: req.body.images ? JSON.stringify( thumbnails ) : null,
            counts: req.body.counts,
            details: req.body.details,
            updated: new Date().toUTCString(),
            state: 1,
            active_state: true,
        }, {
            where: {
                id: Number( req.body.product_id ),
            }
        });
        return res.status(200).json({ status: true, msg: ['함께해요가 성공적으로 업뎃되었습니다']});
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/**
 * 함께해요 참여하기
 *  temp.state === 5 이면 종료된 상태
 *  temp.ended: 마지막 참여회원시 생성됨, 종료될 날짜
 */
router.all("/together-participate", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, ' = 함께해요 참여하기 ');

        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['참여할 레코드를 선택해주세요']});
        else if ( !req.body.email )
            return res.status(200).json({ status: false, msg: ['카톡아이디 혹은 이메일을 입력해주세요']});
        let temp = await Products.findOne({
            where: {
                id: Number( req.body.product_id ),
                deleted: null,
                product_role: "together"
            },
        });

        if ( !temp )
            return res.status(200).json({ status: false, msg: ['요청하신 함께해요는 존재하지 않습니다']});
        // else if ( temp.state === 5 )
        //     return res.status(200).json({ status: false, msg: ['이미 종료된 레코드입니다']});
        else if ( !temp.active_state )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태에 있는 공구입니다']});

        let history = await Togethers.findOne({
            where: {
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.product_id ),
            }
        });
        if ( history )
            return res.status(200).json({ status: false, msg: ['고객님은 요청하신 함께해요에 이미 참여하시였습니다']});

        let together_count = await Togethers.count({
            where: {
                product_id: Number( req.body.product_id ),
            }
        });
        if ( temp.counts <= together_count )
            return res.status(200).json({ status: false, msg: ['정원모집이 완료된 레코드입니다']});
        await Togethers.create({
            user_id: req.body.jwt_data.id,
            product_id: Number( req.body.product_id ),
            email: req.body.email,
            created: new Date().toUTCString(),
        });

        /** 참여하기 알림 게시자에게 보내기 **/
        let title = "[함께해요] " + temp.details;
        let content = req.body.jwt_data.nickname + "님이 함께해요!를 참여했어요.";
        let user_id = temp.user_id;
        let token;
        if ( !user_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        let sale_user = await Users.findOne({
            where: {
                id: Number( user_id ),
                deleted: null,
            },
            attributes: [ 'push_token', 'comment_notification', 'angol_notification', 'tool_notification', 'delivery_notification' ],
        });
        token = sale_user.push_token;
       if(sale_user.comment_notification)
       {
            await Alarms.create({
                user_id: user_id,
                product_role: "together",
                product_id: Number( req.body.product_id ),
                contents: content,
                title: title,
                created: new Date().toUTCString(),
            });
            if ( token ) {
                const push_message = {
                    type: "COMMIT",
                    title: title,
                    body: content,
                    product_id: Number( req.body.product_id ),
                    contents: content,
                    token: [ token ],
                };
                await sendFCM(push_message);
            }
       }
    

        if ( temp.counts === together_count + 1 ) { // 함께해요 종료날짜 결정
            let ended_date = new Date();
            ended_date.setDate( ended_date.getDate() + 2 );
            await Products.update({
                ended_date: ended_date,
            }, {
                where: {
                    id: Number( req.body.product_id ),
                }
            });
        }
        return res.status(200).json({ status: true });

    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});
/**
 * 함께해요 빠지기
 */
router.all("/together-fall", async ( req, res ) => {
    try {
        console.log( req.body.jwt_data.id, req.body.together_id, ' = 함께해요 빠지기 ');

        if ( !req.body.together_id )
            return res.status(200).json({ status: false, msg: ['함께해요 레코드를 선택해주세요']});

        let temp = await Togethers.findOne({
            where: {
                id: Number( req.body.together_id ),
                user_id: req.body.jwt_data.id,
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['존재하지 않은 레코드입니다']});
        // else if ( temp.state === 5 )
        //     return res.status(200).json({ status: false, msg: [ '이미 종료된 레코드입니다' ] });
        await Togethers.destroy({
            where: {
                id: Number( req.body.together_id ),
            }
        });
        /** 함께해요 빠지기 알림 게시자에게 보내기 **/
        let buf = await Products.findOne({
            where: {
                id: Number( temp.product_id ),
            }
        });
        let title = "[함께해요] " + buf.details;
        let content = req.body.jwt_data.nickname + "님이 함께해요!를 포기했어요.";
        let user_id = buf.user_id;
        let token;
        if ( !user_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        let sale_user = await Users.findOne({
            where: {
                id: Number( user_id ),
                deleted: null,
            },
            attributes: [ 'push_token', 'comment_notification', 'angol_notification', 'tool_notification', 'delivery_notification' ],
        });
        token = sale_user.push_token;

      
        await Products.update({
            state: 1,
            ended_date: null,
        }, {
            where: {
                id: Number( temp.product_id ),
            }
        });
        if(sale_user.tool_notification)
        {
            await Alarms.create({
                user_id: user_id,
                product_role: "together",
                product_id: Number( temp.product_id ),
                contents: content,
                title: title,
                created: new Date().toUTCString(),
            });
            if ( token ) {
                const push_message = {
                    type: "TOGETHER FALL",
                    title: title,
                    body: content,
                    product_role: "together",
                    product_id: Number( temp.product_id ),
                    token: [ token ],
                };
                await sendFCM(push_message);
            }
        }
       
        return res.status(200).json({ status: true, msg: ['함께해요 참여가 성공적으로 해지되었습니다'] });
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});

/**
 * 함께해요 상세정보 얻기
 * 하트클릭 상태
 * 구매자인원수 통계
 */
router.all("/get-together-one", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 함께해요 상세정보 얻기 ");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다. 함께해요 레코드를 선택하세요']});
        let temp = await Products.findOne({
            where: {
                product_role: "together",
                id: Number(req.body.product_id),
                deleted: null,
            },
            include: [{
                as: "saleUser",
                model: Users,
                where: { deleted: null, },
                attributes: [ 'name', 'nickname', 'photo', 'thumbnail' ],
            }, {
                as: 'togethers',
                model: Togethers,
                include: [{
                    as: 'participateUsers',
                    model: Users,
                    where: { deleted: null },
                    attributes: ['id', 'name', 'nickname', 'photo', 'thumbnail']
                }],
                attributes: ['id', 'email', 'created'],
                required: false,
            }],
            attributes: ['id', 'user_id', 'counts', 'images', 'details', 'state', 'active_state', 'created']
        });

        if ( !temp )
            return res.status(200).json({ status: false, msg: ['요청하신 함께해요 레코드는 존재하지 않습니다']});
        else if ( !temp.active_state && req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태로 설정되어 있는 레코드입니다']});

        /** 댓글 리스트 얻기 **/
        let buf = await Commits.findAll({
            where: {
                product_id: Number( req.body.product_id ),  // child 아이디리스트 얻기
                deleted: null,
                active_state: true,
            },
            include: [{
                as: "users",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'name', 'nickname', 'thumbnail', ]
            }],
            order: [['level', 'DESC']],
            attributes: [
                'id', 'user_id', 'product_id', 'parent_id', 'level', 'contents', 'created', 'active_state',
            ]
        });

        let tree = await generateCommitTree( buf );

        /** 참여인원수 얻기 **/
        let participate = await Togethers.count({
            where: {
                product_id: Number( req.body.product_id ),
            }
        });
        /** 관심중 클릭상태 얻기 **/
        let favorites = await Favorites.findOne({
            where: {
                user_id: req.body.jwt_data.id,
                product_id: Number( req.body.product_id ),
            },
        });
        let flag = favorites ? favorites.state : false;
        temp = Object.assign( {}, temp['dataValues'], { favorites: flag, participate_count: participate, commits: tree.results || [] });
        return res.status(200).json({ status: true, results: temp});
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});
/**
 * 함께해요 참여인원 상세정보 얻기
 */
router.all("/together-participate-detail", async (req, res) => {
    try {
        console.log( req.body.jwt_data.id, req.body.product_id, " = 함께해요 상세정보 얻기 ");
        if ( !req.body.product_id )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다. 함께해요 레코드를 선택하세요']});
        let temp = await Products.findOne({
            where: {
                product_role: "together",
                id: Number(req.body.product_id),
                deleted: null,
            },
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['요청하신 함께해요 레코드는 존재하지 않습니다']});
        else if ( temp.user_id !== req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님은 본인이 게시한 레코드에 대해서만 이 요청을 하실수 있습니다'] });
        else if ( !temp.active_state && req.body.jwt_data.role !== "admin" )
            return res.status(200).json({ status: false, msg: ['관리자분에 의하여 비노출상태로 설정되어 있는 레코드입니다']});

        let togethers = await Togethers.findAll({
            where: {
                product_id: Number( req.body.product_id ),
            },
            include: [{
                as: "participateUsers",
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: ['id', 'name', 'nickname', 'photo', 'thumbnail']
            }]
        });
        return res.status(200).json({ status: true, results: togethers, ended_date:temp.ended_date});
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});

/**
 * 공구마켓/함께해요 삭제하기
 * 등록한 사용자, 관리자만 가능
 */
router.all("/delete", async (req, res) => {
    try {
        console.log( req.body.jwt_data, req.body.id, " = 공구마켓/함께해요 삭제하기 ");
        if ( !req.body.id )
            return res.status(200).json({ status: false, msg: ['삭제하려는 레코드를 선택하세요']});

        let temp = await Products.findOne({
            where: {
                id: Number( req.body.id ),
                user_id: req.body.jwt_data.id,
            }
        });
           // if ( req.body.jwt_data.role !== "admin" && !temp )
        //     return res.status(200).json({ status: false, msg: ['고객님의 권한으로는 이 요청을 하실수 없습니다']});
       
        if (!temp)
            return res.status(200).json({ status: false, msg: ['이미 삭제된 레코드입니다']});
        else {
            let sale_users = await SalesHistories.findAll( {
                where: {
                    product_id: Number( req.body.id ),
                    deleted: null,
                }
            } );

            if ( sale_users.length > 0 )
                return res.status(200).json({ status: false, msg: ['이미 공구를 구매한 회원이 존재합니다']});
            else {
                // await Products.update({
                //     deleted: new Date().toUTCString(),
                // }, {
                //     where: {
                //         id: Number( req.body.id ),
                //         user_id: req.body.jwt_data.id
                //     }
                // });
                // await ProductContents.update({
                //     deleted: new Date().toUTCString(),
                // }, {
                //     where: {
                //         product_id: Number( req.body.id ),
                //     }
                // });
                await Angcols.destroy({
                    where: {
                        product_id: Number( req.body.id )
                    }
                });
                await Favorites.destroy({
                    where: {
                        product_id: Number( req.body.id )
                    }
                });
                await Togethers.destroy({
                    where: {
                        product_id: Number( req.body.id )
                    }
                });
                await Alarms.destroy({
                    where: {
                        product_id: Number( req.body.id )
                    }
                });
                await Commits.destroy({
                    where: {
                        product_id: Number( req.body.id ),
                        user_id: req.body.jwt_data.id
                    }
                });
                await ProductContents.destroy({
                    where: {
                        product_id: Number( req.body.id ),
                    }
                });
                await Products.destroy( {
                    where: {
                        id: Number( req.body.id ),
                        user_id: req.body.jwt_data.id
                    }
                });
                return res.status(200).json({ status: true, msg: ['선택된 레코드가 성공적으로 삭제되었습니다']});
            }
        }
    } catch (e) {
        return res.status(200).json({status: false, msg: [e.toString()]});
    }
});

/**
 * 공구종료
 * 등록한 사용자, 관리자만 가능
 */
router.all("/end", async ( req, res) => {
    try {
        console.log(req.body.jwt_data.id, " = 공구종료");
        let temp =  await Products.findOne({
            where: {
                id: Number( req.body.product_id ),
            }
        });
        if ( !temp )
            return res.status(200).json({ status: false, msg: ['존재하지 않는 공구입니다']});
        else if ( temp.user_id !== req.body.jwt_data.id )
            return res.status(200).json({ status: false, msg: ['고객님은 본인이 올린 공구에 대해서만 이 요청을 하실수 있습니다']});
        else if ( temp.deleted )
            return res.status(200).json({ status: false, msg: ['이미 삭제된 공구입니다']});
        else if ( temp.state === 4 || temp.state === 5 )
            return res.status(200).json({ status: false, msg: ['이미 종료된 공구입니다']});
        else if ( temp.product_role !== "product" )
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
        else {

            let sale_users = await SalesHistories.findAll( {
                where: {
                    product_id: Number( req.body.product_id ),
                    deleted: null,
                }
            } );
            if ( sale_users.length > 0 )
                return res.status(200).json({ status: false, msg: ['이미 공구를 구매한 회원이 존재합니다']});
            else {
                await Products.update({
                    state: 4,
                    updated: new Date().toUTCString(),
                }, {
                    where: {
                        id: Number( req.body.product_id ),
                    }
                });
                return res.status(200).json({ status: true, msg: ['공구가 성공적으로 종료되었습니다'] });
            }
        }
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString()]});
    }
});

/**
 * 현재 동네범위를 포함하는 홈화면 공구리스트
 * 공구, 함께 해요 둘다 리턴하기
 * 내 위치를 기준으로 검색
 * 앵콜외침수, 앵콜외침한 사용자 썸네일, 최신순으로 5명까지만
 * product_role만 가지고 호출시 전체 리스트 리턴됨
 * 
 * !range && !keyword => 홈화면 초기 로딩시
 * range && !keyword => 공구만 검색시
 * range && keyword => 공구, 함께해요 둘다 검색
 */
router.all("/get-list-home", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 앱 홈화면에 현시될 공구리스트");

        let ranges = [];
        let common_query = {
            deleted: null,
        };
        let user = await Users.findOne({
            where: { id: req.body.jwt_data.id },
        });

        let lat = Number(user['dataValues'].latitude || 0 );
        let lng = Number(user['dataValues'].longitude || 0 );
        //   let address = user.address.split(" ") || "";
        let addressA = user.address.split(" ");
        var address = "";
        if(req.body.range === 4)
        {
            address = addressA[0];
        } else if(req.body.range === 3) {
            address = addressA[0] + " " +  addressA[1];
        }
        let address_detail = ""; //user.address_detail || "";

        if ( !req.body.range && !req.body.keyword ) { // 홈화면 초기 로딩시 -> 디폴트로 내 위치 기준으로 범위 1로 설정된 공구들만 리턴
            common_query = {
                product_role: "product",
                deleted: null,
                active_state: true,
                // range: 1,
                 [Op.not]: [{longitude: 0}, {latitude: 0}],
            }
        } else if ( req.body.range && !req.body.keyword ) {    // 범위설정에 의한 공구리스트 얻기 -> 내 위치기준으로 선택된 범위내 공구들만
            for ( let k = 0; k < req.body.range; k ++ )
                ranges.push( k + 1 );
                console.log("ranges", JSON.stringify(ranges));
            if ( req.body.range === 1 || req.body.range === 2 ) {
                common_query = {
                    product_role: "product",
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                }
            } else if ( req.body.range === 3 || req.body.range === 4 ) {  // 범위 3,4인 경우는 주소매칭된 공구들만
                common_query = {
                    product_role: "product",
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                    // address: { [Op.like]: "%" + address + "%" },
                    // address_detail: { [Op.like]: "%" + address_detail + "%" },
                }
            }
        } else if ( req.body.range && req.body.keyword ) {   // 공구, 함께해요 둘다 리스트 얻기
            for ( let k = 0; k < req.body.range; k ++ )
                ranges.push( k + 1 );
            if ( req.body.range === 1 || req.body.range === 2 ) {
                common_query = {
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                    [Op.or]: [{name: {[Op.like]: "%" + req.body.keyword + "%"}}, {details: {[Op.like]: "%" + req.body.keyword + "%"}}],
                }
            } else if ( req.body.range === 3 || req.body.range === 4 ) {
                common_query = {
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    // address: { [Op.like]: "%" + address + "%" },
                    // address_detail: { [Op.like]: "%" + address_detail + "%" },
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                    [Op.or]: [{name: {[Op.like]: "%" + req.body.keyword + "%"}}, {details: {[Op.like]: "%" + req.body.keyword + "%"}}],
                }
            }
        } else
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});
           
        
        var temp = await Products.findAll({
            where: common_query,
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'name', 'nickname', 'thumbnail'],
            }, {
                as: "productContents",
                model: ProductContents,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'role', 'name', 'price' ],
                required: false,
            }, {
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    final_ended: null,                      // 정산기간이 안된 히스토리만
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",                     // 판매된 히스토리
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "angcols",
                model: Angcols,
                where: {
                    deleted: null,
                },
                include: [{
                    as: "angcolUser",                      // 앵콜외친 사용자
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [ 'id', 'user_id', 'created' ],
                required: false,
            }, {
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "commits",
                model: Commits,
                where: {
                    deleted: null,
                    active_state: true,
                },
                include: [{
                    as: "users",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail', 'name', 'nickname'],
                }],
                attributes: ['id', 'user_id', 'level', 'parent_id', 'contents', 'created', 'active_state'],
                required: false,
            }],
            order: [['created', 'DESC']],
            // attributes: [
            //     'id', 'product_role', 'user_id', 'finish_date', 'counts', 'method', 'is_ad',  'delivery_date', 'images', 'thumbnails', 'name', 'details',
            //     'range', 'address', 'address_detail', 'state', 'p_apply_percentage', 'settlement_period', 'brokerage_fee', 'settlement_date', 'ended_date', 'created', 'longitude', 'latitude',
            //     [Sequelize.literal("6371 * acos(cos(radians("+lat+")) * cos(radians(products.latitude)) * cos(radians("+lng+") - radians(products.longitude)) + sin(radians("+lat+")) * sin(radians(products.latitude)))"),'distance'],
            // ],
            attributes: [
                'id', 'product_role', 'user_id', 'finish_date', 'counts', 'method', 'is_ad',  'delivery_date', 'images', 'thumbnails', 'name', 'details',
                'range', 'address', 'address_detail', 'state', 'p_apply_percentage', 'settlement_period', 'brokerage_fee', 'settlement_date', 'ended_date', 'created', 'longitude', 'latitude',
                [Sequelize.literal("0.0"),'distance'],
            ],
        });
       
       
        if ( req.body.range === 1 )
            temp = temp.filter( item => calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 0.5 );
        else if ( req.body.range === 2 )
         temp = temp.filter( item => (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 0.5) || (item['dataValues'].range > 1 && (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 1.0)));
        else if( req.body.range === 3 )  
        {
            temp = temp.filter( item => (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 0.5 && item['dataValues'].range == 1) || (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 1.0 && item['dataValues'].range == 2) || item['dataValues'].range == 3);
        }  
      
        const total_pages = req.body.page ? Math.ceil(temp.length / parseInt(req.body.page_size)) + 1 : 1;
        const len = temp.length;
        if(req.body.page != null)
        {
            temp = temp.slice(parseInt(req.body.page) * parseInt(req.body.page_size), (parseInt(req.body.page) + 1) * parseInt(req.body.page_size));
        }
        
        for(var ii = 0; ii < temp.length;ii++)
        {
            temp[ii]['dataValues'].distance = calcDistance(lat, lng, temp[ii].latitude, temp[ii].longitude)
             temp[ii]['dataValues'].angcols =  temp[ii]['dataValues'].angcols.sort(function(a, b) {
            var t1 = new Date(a.created);
            var t2 =  new Date(b.created);
            if(t1 > t2)
            {
                return -1;
            } 
            if(t1 < t2)
            {
                return 1;
            }
            return 0;
            });
            temp[ii]['dataValues'].salesHistories =  temp[ii]['dataValues'].salesHistories.sort(function(a, b) {
                var t1 = new Date(a.created);
                var t2 =  new Date(b.created);
                if(t1 > t2)
                {
                    return -1;
                } 
                if(t1 < t2)
                {
                    return 1;
                }
                return 0;
            });
        }
         
        const aramlen = await Alarms.count({
          where :{
              readed : false,
              user_id : user.id
          }
        });
      
        return res.status(200).json({ status: true, results: temp, "got_count":len, "aramlen" : aramlen, "total_pages" : total_pages});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});

/**
 * 현재 동네범위를 포함하는 홈화면 함께해요
 * 공구, 함께 해요 둘다 리턴하기
 * 내 위치를 기준으로 검색
 * 앵콜외침수, 앵콜외침한 사용자 썸네일, 최신순으로 5명까지만
 * product_role만 가지고 호출시 전체 리스트 리턴됨
 *
 * !range && !keyword => 홈화면 초기 로딩시
 * range && !keyword => 공구만 검색시
 * range && keyword => 공구, 함께해요 둘다 검색
 */
router.all("/get-together-list", async ( req, res ) => {
    try {
        console.log(req.body.jwt_data.id, " = 앱 홈화면에 현시될 함께해요리스트");

        let ranges = [];
        let common_query = {
            deleted: null,
        };
        let user = await Users.findOne({
            where: { id: req.body.jwt_data.id },
        });

        let lat = Number(user['dataValues'].latitude || 0 );
        let lng = Number(user['dataValues'].longitude || 0 );
        // let address = user.address || "";
        // let address_detail = user.address_detail || "";

    
         let addressA = user.address.split(" ");
         var address = "";
         if(req.body.range === 4)
         {
             address = addressA[0];
         } else if(req.body.range === 3) {
             address = addressA[0] + " " +  addressA[1];
         }
         let address_detail = "";
        if ( !req.body.range && !req.body.keyword ) { // 홈화면 초기 로딩시
            common_query = {
                product_role: "together",
                deleted: null,
                active_state: true,
                // range: 1,
                [Op.not]: [{longitude: 0}, {latitude: 0}],
            }
        } else if ( req.body.range && !req.body.keyword ) {    // 범위설정에 의한 함께해요 리스트 얻기
            for ( let k = 0; k < req.body.range; k ++ )
                ranges.push( k + 1 );
            if ( req.body.range === 1 || req.body.range === 2 ) {
                common_query = {
                    product_role: "together",
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                }
            } else if ( req.body.range === 3 || req.body.range === 4 ) {
                common_query = {
                    product_role: "together",
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                    // address: { [Op.like]: "%" + address + "%" },
                    // address_detail: { [Op.like]: "%" + address_detail + "%" },
                }
            }
        } else if ( req.body.range && req.body.keyword ) {   // 공구, 함께해요 둘다 리스트 얻기
            for ( let k = 0; k < req.body.range; k ++ )
                ranges.push( k + 1 );
            if ( req.body.range === 1 || req.body.range === 2 ) {
                common_query = {
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    [Op.not]: [{longitude: 0}, {latitude: 0}],
                    [Op.or]: [{details: {[Op.like]: "%" + req.body.keyword + "%"}}],
                }
            } else if ( req.body.range === 3 || req.body.range === 4 ) {
                common_query = {
                    deleted: null,
                    active_state: true,
                    // range: {[Op.in]: ranges},
                    // address: { [Op.like]: "%" + address + "%" },
                    // address_detail: { [Op.like]: "%" + address_detail + "%" },
                    [Op.or]: [{details: {[Op.like]: "%" + req.body.keyword + "%"}}],
                }
            }
        } else
            return res.status(200).json({ status: false, msg: ['잘못된 요청입니다']});

        var temp = await Products.findAll({
            where: common_query,
            include: [{
                as: 'saleUser',
                model: Users,
                where: {
                    deleted: null,
                },
                attributes: [ 'name', 'nickname', 'thumbnail'],
            }, {
                as: "togethers",
                model: Togethers,
                include: [{
                    as: "participateUsers",                     // 참여회원정보 얻기
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "productContents",
                model: ProductContents,
                where: {
                    deleted: null,
                },
                attributes: [ 'id', 'role', 'name', 'price' ],
                required: false,
            }, {
                as: "salesHistories",
                model: SalesHistories,
                where: {
                    final_ended: null,                    // 정산기간이 안된 히스토리만
                    deleted : null,
                },
                include: [{
                    as: "purchaseUser",                     // 판매된 히스토리
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [
                    'id', 'user_id', 'created',
                ],
                required: false,
            }, {
                as: "angcols",
                model: Angcols,
                where: {
                    deleted: null,
                },
                include: [{
                    as: "angcolUser",                         // 앵콜외친 사용자
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail'],
                }],
                order: [['created', 'DESC']],
                // limit: 5,
                attributes: [ 'id', 'user_id', 'created' ],
                required: false,
            }, {
                as: "commits",
                model: Commits,
                where: {
                    deleted: null,
                    active_state: true,
                },
                include: [{
                    as: "users",
                    model: Users,
                    where: {
                        deleted: null,
                    },
                    attributes: ['photo', 'thumbnail', 'name', 'nickname'],
                }],
                attributes: ['id', 'user_id', 'level', 'parent_id', 'contents', 'created', 'active_state'],
                required: false,
            }],
            order: [['created', 'DESC']],
            // attributes: [
            //     'id', 'product_role', 'user_id', 'finish_date', 'counts', 'method', 'delivery_date', 'images', 'thumbnails', 'name', 'details',
            //     'range', 'address', 'address_detail', 'state', 'p_apply_percentage', 'settlement_period', 'brokerage_fee', 'settlement_date', 'ended_date', 'created', 'longitude', 'latitude',
            //     [Sequelize.literal("6371 * acos(cos(radians("+lng+")) * cos(radians(products.latitude)) * cos(radians("+lat+") - radians(products.longitude)) + sin(radians("+lng+")) * sin(radians(products.latitude)))"),'distance'],
            // ],
            attributes: [
                'id', 'product_role', 'user_id', 'finish_date', 'counts', 'method', 'delivery_date', 'images', 'thumbnails', 'name', 'details',
                'range', 'address', 'address_detail', 'state', 'p_apply_percentage', 'settlement_period', 'brokerage_fee', 'settlement_date', 'ended_date', 'created', 'longitude', 'latitude',
                [Sequelize.literal("0.0"),'distance'],
            ],
          
        });
        // if ( req.body.range === 1 )
        //     temp = temp.filter( item => item['dataValues'].distance <= 0.5 );
        // else if ( req.body.range === 2 )
        //     temp = temp.filter( item => item['dataValues'].distance <= 1 );

       if ( req.body.range === 1 )
            temp = temp.filter( item => calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 0.5);
        else if ( req.body.range === 2 )
            temp = temp.filter( item => (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 0.5) || (item['dataValues'].range > 1 && (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 1.0)));
        else if( req.body.range === 3 )  
        {
            temp = temp.filter( item => (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 0.5 && item['dataValues'].range == 1) || (calcDistance(lat, lng, item['dataValues'].latitude, item['dataValues'].longitude) <= 1.0 && item['dataValues'].range == 2) || item['dataValues'].range == 3);
        }

        const total_pages = req.body.page ? Math.ceil(temp.length / parseInt(req.body.page_size))  + 1 : 1;
        const len = temp.length;
        if(req.body.page != null)
        {
            temp = temp.slice(parseInt(req.body.page) * parseInt(req.body.page_size), (parseInt(req.body.page) + 1) * parseInt(req.body.page_size));
        }
            
        for(var ii = 0; ii < temp.length;ii++)
        {
            temp[ii]['dataValues'].distance = calcDistance(lat, lng, temp[ii].latitude, temp[ii].longitude)
        }
        const aramlen = await Alarms.count({
            where :{
                readed : false,
                user_id : user.id
            }
          });
          console.log("togater-result:::", len, total_pages )
            return res.status(200).json({ status: true, results: temp, "got_count":len, "aramlen" : aramlen, "total_pages" : total_pages});
    } catch (e) {
        return res.status(200).json({ status: false, msg: [ e.toString() ]});
    }
});


module.exports = router;